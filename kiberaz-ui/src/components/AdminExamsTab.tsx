import { useCallback, useState } from 'react';
import {
  CheckCircle, ClipboardList, Clock, Crown, Download, Eye, FileText, RefreshCw, Users,
} from 'lucide-react';
import { useAsyncData } from '../hooks/useAsyncData';
import {
  getExamSessionDetail, getExamSessions,
  type AdminExamParticipant, type AdminExamSession, type AdminExamSessionDetail,
} from '../services/adminService';
import {
  Badge, Button, Card, EmptyState, ErrorState, Modal, SearchField, SkeletonList, StatCard,
} from './ui';

// ─── Admin · İmtahan sessiyaları ──────────────────────────────
// Buradakı sətirlər REAL imtahan sessiyalarıdır (ExamSession): VIP hesabın yaratdığı,
// tələbələrin kodla qoşulduğu imtahanlar. Admin onları görür, iştirakçı nəticələrini açır
// və CSV kimi yükləyir. Sessiyanı bağlamaq sahibinin (VIP) öz panelindədir.
//
// TƏHLÜKƏSİZLİK: cavabda iştirakçı e-poçtları var — bu ekran yalnız Admin rolundadır,
// serverdə də [Authorize(Roles = Admin)] ilə qorunur. Sual mətnləri/cavab açarları burada
// ÜMUMİYYƏTLƏ verilmir: nəticə cədvəli yalnız sayğaclardan ibarətdir.

type ToastFn = (msg: string, type: 'success' | 'error') => void;

const STATUS_TONE: Record<AdminExamSession['status'], 'success' | 'neutral'> = {
  'Aktiv': 'success',
  'Bağlı': 'neutral',
};

const formatDateTime = (iso?: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : '—';

// Cədvəldə yalnız tarix göstərilir (saat sətri lazımsız genişlik verirdi); tam vaxt nəticə pəncərəsindədir.
const formatDay = (iso?: string | null) => iso
  ? new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—';

const percent = (value?: number | null) => value === null || value === undefined ? '—' : `${value}%`;

// Nəticələrin arxivi: CSV faylı brauzerdə qurulur, serverə əlavə sorğu getmir.
// Fayl BOM ilə başlayır (\ufeff) — onsuz Excel Azərbaycan hərflərini pozur.
function downloadCsv(detail: AdminExamSessionDetail) {
  // CSV/formula injection (audit F1): Excel/LibreOffice `=`, `+`, `-`, `@`, tab və CR ilə başlayan hüceyrəni
  // formula kimi icra edir (=HYPERLINK, DDE). Sessiya adı VIP-dən, e-poçt istifadəçidən gəlir — belə dəyərlərin
  // qarşısına apostrof qoyulur (Excel mətn kimi göstərir) və həmişə dırnaqlanır.
  const escape = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",;\n\r\t']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [
    ['Sessiya', detail.session.title],
    ['Kod', detail.session.code],
    ['Sahib', detail.session.hostName],
    ['Yaradılıb', formatDateTime(detail.session.createdAt)],
    ['Sual sayı', detail.session.questionCount],
    [],
    ['İştirakçı', 'E-poçt', 'Başlayıb', 'Göndərib', 'Cavablanan', 'Düzgün', 'Faiz'],
    ...detail.participants.map(p => [
      p.name, p.email ?? '', formatDateTime(p.startedAt), formatDateTime(p.submittedAt),
      p.answeredCount, p.correctCount ?? '', p.percentage ?? '',
    ]),
  ];
  const csv = '﻿' + rows.map(row => row.map(escape).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${detail.session.code}-neticeler.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ResultsModal({ session, onClose, onToast }: {
  session: AdminExamSession; onClose: () => void; onToast: ToastFn;
}) {
  const loader = useCallback(async () => {
    const res = await getExamSessionDetail(session.id);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Nəticələr yüklənmədi.');
    return res.data;
  }, [session.id]);
  const { state, reload } = useAsyncData(loader);
  const detail = state.status === 'ready' ? state.data : null;

  return (
    <Modal open onClose={onClose} title={session.title} kicker={`Sessiya ${session.code}`} size="lg" closeOnBackdrop>
      {state.status === 'loading' && <SkeletonList rows={4} />}
      {state.status === 'error' && <ErrorState title="Nəticələr yüklənmədi" text={state.message} onRetry={reload} />}
      {detail && (
        <div className="adm-results">
          <div className="stat-grid">
            <StatCard icon={<Users size={18} />} tone="info" value={detail.session.participantCount} label="İştirakçı" />
            <StatCard icon={<CheckCircle size={18} />} tone="success" value={detail.session.submittedCount} label="Tamamlayan" />
            <StatCard icon={<FileText size={18} />} tone="brand" value={detail.session.questionCount} label="Sual" />
            <StatCard icon={<ClipboardList size={18} />} tone="warning" value={percent(detail.session.averageScore)} label="Orta nəticə" />
          </div>

          {detail.participants.length === 0 ? (
            <EmptyState compact icon={<Users size={20} />} title="İştirakçı yoxdur" text="Bu sessiyaya heç kim qoşulmayıb." />
          ) : (
            <div className="table-wrap">
              <table className="table adm-table">
                <thead>
                  <tr>
                    <th>İştirakçı</th>
                    <th>E-poçt</th>
                    <th>Başlayıb</th>
                    <th>Status</th>
                    <th className="is-num">Cavab</th>
                    <th className="is-num">Nəticə</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.participants.map((p: AdminExamParticipant) => (
                    <tr key={p.id}>
                      <td className="cell-main">{p.name}</td>
                      <td className="cell-muted adm-email">{p.email ?? '—'}</td>
                      <td className="cell-mono">{formatDateTime(p.startedAt)}</td>
                      <td>{p.submittedAt
                        ? <Badge tone="success"><CheckCircle size={12} /> Göndərilib</Badge>
                        : <Badge tone="warning"><Clock size={12} /> Yarımçıq</Badge>}</td>
                      <td className="is-num">{p.answeredCount} / {detail.session.questionCount}</td>
                      <td className="is-num">{p.percentage !== null && p.percentage !== undefined ? <strong>{p.percentage}%</strong> : <span className="text-3">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal__actions">
            <Button variant="outline" onClick={onClose}>Bağla</Button>
            <Button variant="primary" disabled={detail.participants.length === 0}
              onClick={() => { downloadCsv(detail); onToast('Nəticələr CSV faylı kimi yükləndi.', 'success'); }}>
              <Download size={15} /> Nəticələri CSV yüklə
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminExamsTab({ onToast }: { onToast: ToastFn }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminExamSession | null>(null);

  const loader = useCallback(async () => {
    const res = await getExamSessions(search);
    if (!res.success || !res.data) throw new Error(res.errors?.[0] || res.message || 'Sessiyalar yüklənmədi.');
    return res.data;
  }, [search]);
  const { state, reload } = useAsyncData(loader);
  const sessions = state.status === 'ready' ? state.data : [];

  const totals = {
    active: sessions.filter(s => s.status === 'Aktiv').length,
    participants: sessions.reduce((sum, s) => sum + s.participantCount, 0),
    submitted: sessions.reduce((sum, s) => sum + s.submittedCount, 0),
  };

  return (
    <div className="adm">
      <div className="page-header page-header__row">
        <div>
          <span className="kicker">İdarəetmə paneli</span>
          <h1 className="page-header__title">İmtahan sessiyaları</h1>
          <p className="page-header__lead">VIP hesabların yaratdığı imtahanlar və iştirakçı nəticələri. Nəticələri CSV kimi yükləyib saxlaya bilərsiniz.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} aria-label="Siyahını yenilə"><RefreshCw size={14} /></Button>
      </div>

      <div className="stat-grid adm-stats">
        <StatCard icon={<ClipboardList size={18} />} tone="brand" value={sessions.length} label="Sessiya" />
        <StatCard icon={<Clock size={18} />} tone="success" value={totals.active} label="Aktiv sessiya" />
        <StatCard icon={<Users size={18} />} tone="info" value={totals.participants} label="İştirakçı" />
        <StatCard icon={<CheckCircle size={18} />} tone="warning" value={totals.submitted} label="Tamamlanmış cəhd" />
      </div>

      <Card padded={false} className="adm-table-card">
        <div className="adm-toolbar">
          <h3 className="card__title adm-toolbar__title"><ClipboardList size={15} /> Sessiyalar {state.status === 'ready' && <span className="tab__count">({sessions.length})</span>}</h3>
          <div className="adm-toolbar__right">
            <SearchField value={search} onChange={setSearch} label="Sessiya axtar" placeholder="Başlıq, kod və ya sahib..." size="sm" className="adm-search" />
          </div>
        </div>

        {state.status === 'loading' && <div className="card--pad"><SkeletonList rows={5} /></div>}
        {state.status === 'error' && <ErrorState title="Sessiyalar yüklənmədi" text={state.message} onRetry={reload} />}
        {state.status === 'ready' && sessions.length === 0 && (
          <EmptyState icon={<ClipboardList size={20} />} title="Sessiya tapılmadı"
            text={search ? 'Axtarış sorğusunu dəyişin.' : 'Hələ imtahan sessiyası yaradılmayıb.'} />
        )}
        {state.status === 'ready' && sessions.length > 0 && (
          <div className="table-wrap">
            <table className="table adm-table">
              <thead>
                <tr>
                  <th>Sessiya</th>
                  <th>Sahib</th>
                  <th>Quruluş</th>
                  <th className="is-num">İştirakçı</th>
                  <th className="is-num">Orta</th>
                  <th>Status</th>
                  <th>Tarix</th>
                  <th className="cell-actions">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                    <tr key={session.id}>
                      {/* Kod başlığın altında göstərilir — ayrıca sütun cədvəli lazımsız genişləndirirdi. */}
                      <td>
                        <div className="adm-user__text adm-session">
                          <span className="cell-main">{session.title}</span>
                          <span className="cell-sub cell-mono">{session.code}</span>
                        </div>
                      </td>
                      <td>
                        <span className="adm-host"><Crown size={11} /> {session.hostName}</span>
                      </td>
                      <td className="cell-muted">{session.questionCount} sual · {session.durationMinutes} dəq</td>
                      <td className="is-num">{session.submittedCount} / {session.participantCount}</td>
                      <td className="is-num">{percent(session.averageScore)}</td>
                      <td><Badge tone={STATUS_TONE[session.status]} dot>{session.status}</Badge></td>
                      <td className="cell-mono" title={formatDateTime(session.createdAt)}>{formatDay(session.createdAt)}</td>
                      <td>
                        <div className="cell-actions">
                          <Button variant="outline" size="sm" onClick={() => setResults(session)}><Eye size={13} /> Nəticələr</Button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {results && <ResultsModal session={results} onClose={() => setResults(null)} onToast={onToast} />}

    </div>
  );
}
