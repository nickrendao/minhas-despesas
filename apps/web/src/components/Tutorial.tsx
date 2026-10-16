'use client';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './BrandMark';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { Tile } from './ui';
import { useAppMode } from '@/lib/app-mode';

/* Figuras do tutorial: montadas com os mesmos componentes do app. Sem valores em reais de propósito (para não parecerem dados reais). */
const Row = ({ icon, color, name, sub, right }: { icon: string; color: string; name: string; sub?: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mini-row"><Tile name={icon} color={color} /><span className="nm-wrap"><b className="nm">{name}</b>{sub && <span className="sub">{sub}</span>}</span>{right}</div>
);
const ArtWelcome = () => (<div className="art-center"><BrandMark size={84} /><div className="mini-chips"><span><Icon name="up" size={14} />Rendas</span><span><Icon name="arrowDown" size={14} />Despesas</span><span><Icon name="card" size={14} />Cartões</span></div></div>);
const ArtIncome = () => (<div className="art-stack"><Row icon="up" color="#009929" name="Salário" sub={<><span className="pill-main">Principal</span>Repete todo mês</>} right={<span className="star on"><Icon name="star" size={18} /></span>} />
  <Row icon="up" color="#009929" name="Freela" sub="Só neste mês" right={<span className="star"><Icon name="star" size={18} /></span>} /></div>);
const ArtExpense = () => (<div className="art-stack"><Row icon="home" color="#B85C38" name="Aluguel" sub="Vence dia 5 · repete todo mês" />
  <div className="mini-icons">{[['wifi', '#3B6B8C'], ['bolt', '#C9A227'], ['cart', '#1F6F54'], ['car', '#7A4B8C'], ['book', '#A8497A'], ['paw', '#8C5B3B']].map(([n, c]) => <Tile key={n} name={n} color={c} />)}<span className="mini-fab"><Icon name="plus" size={20} stroke={2.4} /></span></div></div>);
const ArtCards = () => (<div className="art-stack"><div className="mini-wallet"><span className="chip-ico" /><b>Seu cartão</b></div><div className="meter"><div className="track"><i style={{ width: '46%' }} /></div><span className="mark" style={{ left: '80%' }} /></div><div className="meter-legend"><span>limite usado</span><span>alerta em 80%</span></div></div>);
const ArtMonth = () => (<div className="art-stack"><div className="mini-hero"><span className="hl">Sobra do mês</span><div className="segbar" style={{ background: 'var(--hero-track)' }}>{['#B85C38', '#1F6F54', '#7A4B8C', '#C9A227'].map((c, i) => <i key={c} style={{ width: `${[26, 18, 12, 8][i]}%`, ['--c' as any]: c, ['--tone' as any]: ['#14150D', '#2E3120', '#474A36', '#5C5F48'][i] }} />)}</div><span className="hl">parte da renda já comprometida</span></div>
  <div className="mini-chips"><span><Icon name="clock" size={14} />Vence em breve</span><span><Icon name="bars" size={14} />Visão anual</span></div></div>);
const ArtPrivacy = () => (<div className="art-center"><div className="mini-icons"><span className="icon-btn"><Icon name="eye" size={18} /></span><span className="icon-btn"><Icon name="moon" size={18} /></span><span className="icon-btn"><Icon name="lock" size={18} /></span></div><div className="mini-chips"><span>Ocultar valores</span><span>Tema escuro</span><span>PIN</span></div></div>);

const STEPS: { title: string; text: string; art: React.ReactNode }[] = [
  { title: 'Bem-vindo(a) ao Minhas Despesas', text: 'Em menos de um minuto você vê como organizar seu dinheiro. Dá para pular agora e rever quando quiser, em Configurações.', art: <ArtWelcome /> },
  { title: 'Comece pelas suas rendas', text: 'Cadastre até 3 rendas por mês (salário, freela…). Toque na estrela para escolher a principal. Ative “Repetir todo mês” e ela já aparece nos meses seguintes.', art: <ArtIncome /> },
  { title: 'Lance suas despesas', text: 'Use o botão + para adicionar. Fixas se repetem todo mês; variáveis valem só para aquele mês. Informe o vencimento e as parcelas, e escolha um ícone e uma cor para reconhecer cada uma.', art: <ArtExpense /> },
  { title: 'Cartões de crédito', text: 'Cadastre até 5 cartões com o limite e lance as compras, inclusive as parceladas. Avisamos quando você passar de 80% do limite.', art: <ArtCards /> },
  { title: 'Acompanhe o mês', text: 'No painel você vê quanto sobra, quanto da renda já está comprometida, o que vence em breve e para onde o dinheiro vai. A Agenda e a Visão anual mostram o resto.', art: <ArtMonth /> },
  { title: 'Sua privacidade, do seu jeito', text: 'O botão de olho oculta os valores na tela (e você pode criar um PIN para mostrá-los). O tema escuro fica a um toque. Seus dados são seus: dá para baixar um backup ou excluir tudo quando quiser.', art: <ArtPrivacy /> },
];

const LOCAL_LAST = 'O botão de olho oculta os valores na tela (e você pode criar um PIN para mostrá-los). O tema escuro fica a um toque. Seus dados ficam só neste aparelho: baixe um backup em Configurações de vez em quando, para não perdê-los se trocar de celular.';

/** Tutorial básico de primeiro acesso. Fechar por qualquer caminho (pular, Esc, concluir) conta como "visto". */
export function Tutorial({ onFinish }: { onFinish: () => void }) {
  const local = useAppMode().local; const steps = local ? STEPS.map((s, k) => (k === STEPS.length - 1 ? { ...s, text: LOCAL_LAST } : s)) : STEPS;
  const [i, setI] = useState(0); const step = steps[i]; const last = i === steps.length - 1;
  const next = () => (last ? onFinish() : setI((v) => v + 1)); const back = () => setI((v) => Math.max(0, v - 1));
  const nextRef = useRef<HTMLButtonElement>(null); const act = useRef({ next, back }); act.current = { next, back };
  // setas do teclado funcionam mesmo se o foco se perder (ex.: o botão "Voltar" some ao chegar no 1º passo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') act.current.next(); else if (e.key === 'ArrowLeft') act.current.back(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (!document.activeElement || document.activeElement === document.body) nextRef.current?.focus(); }, [i]);   // devolve o foco ao "Próximo"
  return (
    <Dialog title={step.title} onClose={onFinish} wide>
      <div className="tutorial">
        <p className="tut-count" aria-live="polite">Passo {i + 1} de {steps.length}</p>
        <div className="tut-art" aria-hidden="true">{step.art}</div>
        <p className="tut-text">{step.text}</p>
        <ol className="tut-dots" aria-hidden="true">{steps.map((s, k) => <li key={s.title} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</ol>
        <div className="form-actions tut-actions">
          {!last ? <button type="button" className="link" onClick={onFinish}>Pular tutorial</button> : <span />}
          <span className="tut-nav">
            <button type="button" className="btn ghost" onClick={back} disabled={i === 0}>Voltar</button>
            <button type="button" className="btn" data-autofocus ref={nextRef} onClick={next}>{last ? 'Começar a usar' : 'Próximo'}{!last && <Icon name="right" size={17} stroke={2.4} />}</button>
          </span>
        </div>
      </div>
    </Dialog>
  );
}
