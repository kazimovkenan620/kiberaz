import { useState, type ReactNode } from 'react';
import { Plus, Send } from 'lucide-react';
import { uploadInstructorPhoto, uploadSyllabusPdf, type CreateCourseRequest } from '../services/courseService';
import { DEFAULT_COURSE_ACCENT } from '../utils/courseAccent';
import { Button, FormField } from './ui';

// ─── Təlim forması (yaratma + redaktə) ───────────────────────
// Ana səhifədəki "Təlim əlavə et" və kabinetdəki "Redaktə" eyni formanı işlədir: sahələr, yoxlama
// mesajları və fayl yükləmə bir yerdədir. Forma yalnız məlumatı toplayır və `onSubmit`-ə ötürür —
// hansı endpoint-ə gedəcəyi (POST /course və ya PUT /course/{id}) çağıranın işidir.
// Server qaydaları (VIP, kredit, moderasiya) burada təkrar edilmir: serverin cavabı olduğu kimi göstərilir.

export type CourseFormValues = Omit<CreateCourseRequest, 'syllabusTopics' | 'accentColor'> & {
  syllabusTopics: string[];
};

const EMPTY: CourseFormValues = {
  instructorName: '', instructorRole: '', instructorCompany: '', linkedInUrl: '', gitHubUrl: '',
  contactEmail: '', contactPhone: '', courseTitle: '', kicker: '', description: '', duration: '',
  level: '', language: 'Azərbaycan dili', syllabusTopics: ['', '', ''], instructorPhotoUrl: undefined, syllabusFileUrl: undefined,
};

interface Props {
  initial?: Partial<CourseFormValues>;
  submitLabel: string;
  submitIcon?: ReactNode;
  /** Formanın üstündə göstərilən izah (məs. moderasiya qeydi). */
  notice?: ReactNode;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (request: CreateCourseRequest) => Promise<{ success: boolean; message?: string; errors?: string[] }>;
}

export default function CourseForm({ initial, submitLabel, submitIcon, notice, disabled, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<CourseFormValues>(() => ({
    ...EMPTY, ...initial,
    syllabusTopics: initial?.syllabusTopics?.length ? [...initial.syllabusTopics] : EMPTY.syllabusTopics,
  }));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    setValues(current => ({ ...current, [key]: value }));
  const setTopic = (index: number, value: string) =>
    setValues(current => ({ ...current, syllabusTopics: current.syllabusTopics.map((t, i) => (i === index ? value : t)) }));
  const addTopic = () => setValues(current => ({ ...current, syllabusTopics: [...current.syllabusTopics, ''] }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || disabled) return;
    setLoading(true);
    setErrors([]);
    try {
      // 1. Fayllar əvvəl yüklənir; serverin qaytardığı NİSBİ yol sorğuya yazılır.
      let instructorPhotoUrl = values.instructorPhotoUrl || undefined;
      let syllabusFileUrl = values.syllabusFileUrl || undefined;
      if (photoFile) {
        const photo = await uploadInstructorPhoto(photoFile);
        if (!photo.success || !photo.data) {
          setErrors(photo.errors?.length ? photo.errors : [photo.message || 'Müəllim şəkli yüklənərkən xəta baş verdi.']);
          return;
        }
        instructorPhotoUrl = photo.data;
      }
      if (syllabusFile) {
        const syllabus = await uploadSyllabusPdf(syllabusFile);
        if (!syllabus.success || !syllabus.data) {
          setErrors(syllabus.errors?.length ? syllabus.errors : [syllabus.message || 'Təlim sillabusu yüklənərkən xəta baş verdi.']);
          return;
        }
        syllabusFileUrl = syllabus.data;
      }

      const request: CreateCourseRequest = {
        instructorName: values.instructorName.trim(),
        instructorRole: values.instructorRole.trim(),
        instructorCompany: values.instructorCompany?.trim() || undefined,
        linkedInUrl: values.linkedInUrl?.trim() || undefined,
        gitHubUrl: values.gitHubUrl?.trim() || undefined,
        contactEmail: values.contactEmail?.trim() || undefined,
        contactPhone: values.contactPhone?.trim() || undefined,
        courseTitle: values.courseTitle.trim(),
        kicker: values.kicker?.trim() || undefined,
        description: values.description.trim(),
        duration: values.duration.trim(),
        level: values.level,
        language: values.language || 'Azərbaycan dili',
        syllabusTopics: values.syllabusTopics.map(t => t.trim()).filter(Boolean),
        // API kontraktı: yalnız icazəli token adları; dizayn sistemində vurğu brend rəngidir.
        accentColor: DEFAULT_COURSE_ACCENT,
        instructorPhotoUrl,
        syllabusFileUrl,
      };

      const result = await onSubmit(request);
      if (!result.success) {
        // Serverdən bir neçə xəta gələ bilər — hamısı bir sətirdə birləşdirilsə oxunmur.
        setErrors(result.errors?.length ? result.errors : [result.message || 'Xəta baş verdi.']);
      }
    } catch {
      setErrors(['Serverlə əlaqə yaradıla bilmədi.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="course-form" onSubmit={handleSubmit}>
      {notice}

      <div className="form-section">Müəllim məlumatları</div>
      <div className="form-grid form-grid--2">
        <FormField id="instructor" label="Müəllim adı" required>
          <input id="instructor" className="input" type="text" placeholder="Ad Soyad" required value={values.instructorName} onChange={e => set('instructorName', e.target.value)} />
        </FormField>
        <FormField id="role" label="Vəzifə" required>
          <input id="role" className="input" type="text" placeholder="Senior Security Engineer" required value={values.instructorRole} onChange={e => set('instructorRole', e.target.value)} />
        </FormField>
      </div>
      <div className="form-grid form-grid--3">
        <FormField id="company" label="Şirkət">
          <input id="company" className="input" type="text" placeholder="Şirkət adı" value={values.instructorCompany ?? ''} onChange={e => set('instructorCompany', e.target.value)} />
        </FormField>
        <FormField id="linkedin" label="LinkedIn URL">
          <input id="linkedin" className="input" type="url" placeholder="https://linkedin.com/in/..." value={values.linkedInUrl ?? ''} onChange={e => set('linkedInUrl', e.target.value)} />
        </FormField>
        <FormField id="github" label="GitHub URL">
          <input id="github" className="input" type="url" placeholder="https://github.com/..." value={values.gitHubUrl ?? ''} onChange={e => set('gitHubUrl', e.target.value)} />
        </FormField>
      </div>
      <FormField id="photoFile" label="Müəllim şəkli" hint={values.instructorPhotoUrl ? 'Mövcud şəkil saxlanılır; yenisini seçsəniz əvəz olunur. PNG, JPG, WEBP — maksimum 2MB' : 'PNG, JPG, WEBP — maksimum 2MB'}>
        <input id="photoFile" className="input" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
      </FormField>

      <div className="form-section">Təlim məlumatları</div>
      <div className="form-grid form-grid--2">
        <FormField id="courseTitle" label="Təlim başlığı" required>
          <input id="courseTitle" className="input" type="text" placeholder="Web Application Pentesting" required value={values.courseTitle} onChange={e => set('courseTitle', e.target.value)} />
        </FormField>
        <FormField id="kicker" label="Üst başlıq (kicker)">
          <input id="kicker" className="input" type="text" placeholder="YENİ QRUP: 15 OKTYABR" value={values.kicker ?? ''} onChange={e => set('kicker', e.target.value)} />
        </FormField>
      </div>
      <div className="form-grid form-grid--3">
        <FormField id="duration" label="Müddət" required>
          <input id="duration" className="input" type="text" placeholder="8 həftə" required minLength={2} value={values.duration} onChange={e => set('duration', e.target.value)} />
        </FormField>
        <FormField id="level" label="Səviyyə" required>
          <select id="level" className="select" required value={values.level} onChange={e => set('level', e.target.value)}>
            <option value="">Seçin...</option>
            <option>Başlanğıc</option><option>Başlanğıc → Orta</option>
            <option>Orta</option><option>Orta → Peşəkar</option><option>Peşəkar</option>
          </select>
        </FormField>
        <FormField id="lang" label="Dil">
          <select id="lang" className="select" value={values.language} onChange={e => set('language', e.target.value)}>
            <option>Azərbaycan dili</option><option>İngilis dili</option><option>Rus dili</option>
          </select>
        </FormField>
      </div>
      <FormField id="syllabusFile" label="Təlim sillabusu" hint={values.syllabusFileUrl ? 'Mövcud PDF saxlanılır; yenisini seçsəniz əvəz olunur. PDF — maksimum 10MB' : 'PDF — maksimum 10MB'}>
        <input id="syllabusFile" className="input" type="file" accept="application/pdf" onChange={e => setSyllabusFile(e.target.files?.[0] || null)} />
      </FormField>
      <FormField id="description" label="Təlim açıqlaması" required>
        <textarea id="description" className="textarea" rows={3} placeholder="Təlimin məzmunu, hədəf auditoriyası..." required value={values.description} onChange={e => set('description', e.target.value)} />
      </FormField>
      <div className="form-grid form-grid--2">
        <FormField id="contactEmail" label="E-poçt (Gmail)">
          <input id="contactEmail" className="input" type="email" placeholder="təlim@gmail.com" value={values.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value)} />
        </FormField>
        <FormField id="contactPhone" label="Əlaqə nömrəsi">
          <input id="contactPhone" className="input" type="tel" placeholder="+994 XX XXX XX XX" value={values.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} />
        </FormField>
      </div>

      <div className="field">
        <span className="field__label" id="syllabus-label">Proqram mövzuları</span>
        <div className="syllabus-inputs" role="group" aria-labelledby="syllabus-label">
          {values.syllabusTopics.map((topic, i) => (
            <div key={i} className="syllabus-input-row">
              <span className="syllabus-input-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <input type="text" className="input" value={topic} onChange={e => setTopic(i, e.target.value)} placeholder={`Mövzu ${i + 1}...`} aria-label={`Mövzu ${i + 1}`} />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addTopic}><Plus size={13} /> Mövzu əlavə et</Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="notice notice--danger" role="alert" aria-live="assertive">
          <ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul>
        </div>
      )}

      <div className="modal__actions modal__actions--between">
        <span className="modal__note">* Mütləq doldurulmalı olan sahələr.</span>
        <div className="auth-form__actions">
          <Button variant="outline" onClick={onCancel}>Ləğv et</Button>
          <Button type="submit" variant="primary" loading={loading} disabled={disabled}>{submitIcon ?? <Send size={14} />} {submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
