import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import ExamSession from '../src/components/ExamSession';
import Navbar from '../src/components/Navbar';
import { Modal } from '../src/components/ui';
import { setStoredUserRoles, setTokens } from '../src/services/authService';
import '../src/index.css';

export function ModalFixture() {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [trigger, setTrigger] = useState(true);
  return <>
    <button id="fallback">Ehtiyat fokus</button>
    {trigger && <button id="opener" onClick={() => setOpen(true)}>Aç</button>}
    <Modal open={open} onClose={() => setOpen(false)} title="Əsas pəncərə">
      <input autoFocus aria-label="İlkin fokus" />
      <button id="nested-opener" onClick={() => setNested(true)}>İç pəncərəni aç</button>
      <button id="remove-opener" onClick={() => setTrigger(false)}>Açan düyməni sil</button>
      <Modal open={nested} onClose={() => setNested(false)} title="İç pəncərə">
        <input autoFocus aria-label="İç fokus" />
      </Modal>
    </Modal>
  </>;
}

const mode = location.pathname === '/google-login-callback' ? 'app' : new URLSearchParams(location.search).get('mode');
if (mode === 'exam') {
  setTokens('synthetic-test-token');
  setStoredUserRoles(['User']);
}
const content = mode === 'exam' ? <ExamSession /> : mode === 'modal' ? <ModalFixture />
  : mode === 'navbar' ? <Navbar /> : mode === 'app' ? <App /> : null;
createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
