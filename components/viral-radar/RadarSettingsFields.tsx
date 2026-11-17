"use client";

import { VIDEO_QUEUE_CATEGORIES, findCategory } from "@/lib/video-queue/catalog";
import {
  CAPTION_STYLE_LABEL,
  FREQUENCY_PRESETS,
  type CaptionMode,
  type CaptionStyle,
  type PriorityMode,
  type RadarCriteria,
  type ScoreWeights,
} from "@/lib/viral-radar/types";
import { inputClass, labelClass } from "@/components/video-queue/QueueSettingsFields";

/**
 * Campos compartilhados entre "Novo radar" e "Configurações": informações,
 * frequência, critérios, pesos do Viral Score, modos, reabastecimento,
 * legendas/IA e processamento do vídeo.
 */

export interface RadarFormState {
  name: string;
  category: string;
  theme: string;
  keywords: string;
  hashtags: string;
  language: string;
  region: string;
  frequencyMinutes: number;
  criteria: RadarCriteria;
  scoreWeights: ScoreWeights;
  autoMode: boolean;
  supervisedMode: boolean;
  queueMin: number;
  queueTarget: number;
  priorityMode: PriorityMode;
  captionMode: CaptionMode;
  captionStyle: CaptionStyle;
  aiClassification: boolean;
  aiDailyCap: number;
  reframeMode: "NONE" | "FIT_9_16";
  maxDurationSeconds: string;
}

export function toRequestBody(state: RadarFormState): Record<string, unknown> {
  return {
    ...state,
    keywords: state.keywords.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean),
    hashtags: state.hashtags.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean),
    maxDurationSeconds: state.maxDurationSeconds ? Number(state.maxDurationSeconds) : null,
  };
}

const WEIGHT_LABEL: Record<keyof ScoreWeights, string> = {
  velocity: "Crescimento das visualizações",
  likeRate: "Curtidas ÷ visualizações",
  commentRate: "Comentários ÷ visualizações",
  recency: "Atualidade",
  relevance: "Relevância para o tema",
};

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        {description ? <p className="text-xs text-zinc-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function RadarSettingsFields({ value, onChange, lockTheme = false }: { value: RadarFormState; onChange: (next: RadarFormState) => void; lockTheme?: boolean }) {
  const set = <K extends keyof RadarFormState>(key: K, next: RadarFormState[K]) => onChange({ ...value, [key]: next });
  const setCriteria = <K extends keyof RadarCriteria>(key: K, next: number) => onChange({ ...value, criteria: { ...value.criteria, [key]: next } });
  const setWeight = (key: keyof ScoreWeights, next: number) => onChange({ ...value, scoreWeights: { ...value.scoreWeights, [key]: next } });
  const weightTotal = Object.values(value.scoreWeights).reduce((sum, item) => sum + (Number(item) || 0), 0);
  const isPreset = FREQUENCY_PRESETS.some((preset) => preset.minutes === value.frequencyMinutes);
  const category = findCategory(value.category);

  return (
    <div className="space-y-4">
      <Section title="Informações">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Nome do radar
            <input className={inputClass} value={value.name} maxLength={80} onChange={(event) => set("name", event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Categoria
              <select className={inputClass} disabled={lockTheme} value={value.category} onChange={(event) => set("category", event.target.value)}>
                {VIDEO_QUEUE_CATEGORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Tema
              <select className={inputClass} disabled={lockTheme} value={value.theme} onChange={(event) => set("theme", event.target.value)}>
                {(category?.themes ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>
            Palavras-chave (uma por linha ou separadas por vírgula)
            <textarea className={`${inputClass} h-24`} value={value.keywords} onChange={(event) => set("keywords", event.target.value)} />
          </label>
          <label className={labelClass}>
            Hashtags
            <input className={inputClass} value={value.hashtags} onChange={(event) => set("hashtags", event.target.value)} placeholder="#GTA6 #GTAVI" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Idioma
              <input className={inputClass} value={value.language} maxLength={2} onChange={(event) => set("language", event.target.value.toLowerCase())} />
            </label>
            <label className={labelClass}>
              País/região
              <input className={inputClass} value={value.region} maxLength={2} onChange={(event) => set("region", event.target.value.toUpperCase())} />
            </label>
          </div>
        </div>
      </Section>

      <Section title="Frequência da pesquisa" description="Quando a fila já está abastecida, a pesquisa agendada é adiada para economizar cota.">
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              aria-pressed={value.frequencyMinutes === preset.minutes}
              onClick={() => set("frequencyMinutes", preset.minutes)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${value.frequencyMinutes === preset.minutes ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-300"}`}
            >
              {preset.label}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <span className={isPreset ? "" : "font-semibold"}>Personalizada (min)</span>
            <input
              type="number"
              min={60}
              max={10080}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
              value={value.frequencyMinutes}
              onChange={(event) => set("frequencyMinutes", Number(event.target.value))}
            />
          </label>
        </div>
      </Section>

      <Section title="Critérios de seleção" description="Métricas indisponíveis nunca são estimadas: conteúdo de terceiros sem a métrica não passa no critério.">
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["minViews", "Visualizações mínimas"],
              ["minLikes", "Curtidas mínimas"],
              ["minComments", "Comentários mínimos"],
              ["maxAgeHours", "Idade máxima (horas)"],
              ["minScore", "Viral Score mínimo (0–100)"],
              ["maxSelectedPerRun", "Máximo selecionado por execução"],
            ] as Array<[keyof RadarCriteria, string]>
          ).map(([key, label]) => (
            <label key={key} className={labelClass}>
              {label}
              <input type="number" min={0} className={inputClass} value={value.criteria[key]} onChange={(event) => setCriteria(key, Number(event.target.value))} />
            </label>
          ))}
        </div>
        <details className="rounded-md bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-800">Pesos do Viral Score (somam 100 — atual: {weightTotal})</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {(Object.keys(WEIGHT_LABEL) as Array<keyof ScoreWeights>).map((key) => (
              <label key={key} className="block text-xs font-medium text-zinc-700">
                {WEIGHT_LABEL[key]}
                <input type="number" min={0} max={100} className={inputClass} value={value.scoreWeights[key]} onChange={(event) => setWeight(key, Number(event.target.value))} />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            O crescimento só é calculado com duas observações reais (nunca &quot;visualizações totais por hora&quot;). Componentes sem dado ficam de fora e reduzem a cobertura.
          </p>
        </details>
      </Section>

      <Section title="Modos e direitos">
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" className="mt-1" checked={value.autoMode} onChange={(event) => set("autoMode", event.target.checked)} />
          <span>
            <strong>Automático</strong> — importa e publica sozinho somente vídeos <strong>próprios ou licenciados</strong> (fontes com declaração de direitos).
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" className="mt-1" checked={value.supervisedMode} onChange={(event) => set("supervisedMode", event.target.checked)} />
          <span>
            <strong>Supervisionado</strong> — vídeos de terceiros ficam como &quot;Aguardando autorização&quot;; só entram na fila se você aprovar declarando a licença. Desligado, viram apenas referência para conteúdo original.
          </span>
        </label>
      </Section>

      <Section title="Fila e reabastecimento">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Tamanho ideal da fila
            <input type="number" min={1} max={1000} className={inputClass} value={value.queueTarget} onChange={(event) => set("queueTarget", Number(event.target.value))} />
          </label>
          <label className={labelClass}>
            Reabastecer abaixo de
            <input type="number" min={0} max={500} className={inputClass} value={value.queueMin} onChange={(event) => set("queueMin", Number(event.target.value))} />
          </label>
          <label className={labelClass}>
            Prioridade
            <select className={inputClass} value={value.priorityMode} onChange={(event) => set("priorityMode", event.target.value as PriorityMode)}>
              <option value="SCORE">Viral Score (com envelhecimento)</option>
              <option value="FIFO">Ordem de chegada (FIFO)</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Legendas, IA e processamento">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Legenda
            <select className={inputClass} value={value.captionMode} onChange={(event) => set("captionMode", event.target.value as CaptionMode)}>
              <option value="TEMPLATE">Modelo da fila</option>
              <option value="AI">IA (com o modelo como reserva)</option>
            </select>
          </label>
          <label className={labelClass}>
            Estilo
            <select className={inputClass} value={value.captionStyle} onChange={(event) => set("captionStyle", event.target.value as CaptionStyle)}>
              {(Object.keys(CAPTION_STYLE_LABEL) as CaptionStyle[]).map((style) => (
                <option key={style} value={style}>
                  {CAPTION_STYLE_LABEL[style]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Limite diário de IA
            <input type="number" min={0} max={500} className={inputClass} value={value.aiDailyCap} onChange={(event) => set("aiDailyCap", Number(event.target.value))} />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-800 sm:col-span-3">
            <input type="checkbox" className="mt-1" checked={value.aiClassification} onChange={(event) => set("aiClassification", event.target.checked)} />
            Classificar os melhores candidatos com IA (assunto, relevância, tipo: notícia, rumor, teoria…). Sem IA, a relevância usa as palavras-chave.
          </label>
          <label className={labelClass}>
            Formato do vídeo
            <select className={inputClass} value={value.reframeMode} onChange={(event) => set("reframeMode", event.target.value as RadarFormState["reframeMode"])}>
              <option value="NONE">Manter o original</option>
              <option value="FIT_9_16">Adaptar para 9:16 (sem cortar nem distorcer)</option>
            </select>
          </label>
          <label className={labelClass}>
            Duração máxima (s)
            <input type="number" min={3} max={900} className={inputClass} value={value.maxDurationSeconds} placeholder="sem limite" onChange={(event) => set("maxDurationSeconds", event.target.value)} />
          </label>
        </div>
        <p className="text-xs text-zinc-600">O arquivo original é sempre preservado; a versão adaptada é um arquivo novo.</p>
      </Section>
    </div>
  );
}
