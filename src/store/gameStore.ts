/**
 * Store global da partida (Zustand). Orquestra o loop de turno:
 *   jobs dos soldados → fase da IA → renda → checagem de vitória.
 * Cada soldado de pé faz UM job por turno (vender/sondar/proteger/invadir/mover);
 * ações de gestão (armar/recrutar/boca/advogado) dependem só de caixa.
 * Persiste automaticamente no AsyncStorage a cada mudança relevante.
 */

import { create } from 'zustand';
import { criarPartida } from '../data/seed';
import {
  aplicarBatidaPolicial,
  aplicarRenda,
  addLog,
  clonar,
  comprarArma as comprarArmaEngine,
  construirBoca as construirBocaEngine,
  contratarAdvogado as contratarAdvogadoEngine,
  invadirComSoldado,
  limparIntelExpirado,
  moverSoldado as moverSoldadoEngine,
  protegerBairro as protegerBairroEngine,
  recrutarSoldado as recrutarSoldadoEngine,
  resetarJobs,
  sondarComSoldado,
  venderNoBairro as venderNoBairroEngine,
  type ResultadoAcao,
} from '../engine/actions';
import { executarTurnoIA } from '../engine/ai';
import { bairroDe, iasDe, soldadosDisponiveis } from '../engine/selectors';
import { avaliarStatus } from '../engine/victory';
import { carregarJogo, salvarJogo } from '../storage/persistence';
import type { GameState } from '../types/game';

/** Deixa visual pra UI animar o resultado de um combate. */
interface FlashCombate {
  cor: 'vitoria' | 'derrota' | null;
  /** Incrementa a cada combate — a UI observa a mudança pra disparar a animação. */
  seq: number;
}

interface GameStore {
  game: GameState | null;
  /** Mensagem curta da última ação (sucesso ou erro) pra feedback na UI. */
  feedback: string | null;
  /** Cue de animação do último combate. */
  flash: FlashCombate;
  temSave: boolean;

  novoJogo: () => void;
  carregar: () => Promise<boolean>;
  verificarSave: () => Promise<void>;
  sairParaMenu: () => void;
  limparFeedback: () => void;

  // Jobs por soldado (gastam o turno do soldado).
  moverSoldado: (soldadoId: string, destinoId: string) => void;
  venderNoBairro: (soldadoId: string) => void;
  protegerBairro: (soldadoId: string) => void;
  sondarBairro: (soldadoId: string, alvoId: string) => void;
  invadirBairro: (soldadoId: string, alvoId: string) => void;

  // Gestão da facção (dependem só de caixa, não gastam job).
  comprarArma: (armaId: string, soldadoId: string) => void;
  recrutarSoldado: (bairroId: string) => void;
  construirBoca: (bairroId: string) => void;
  contratarAdvogado: () => void;

  passarTurno: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Aplica o resultado de uma ação; atualiza o contador de soldados livres e persiste. */
  function aplicar(resultado: ResultadoAcao): boolean {
    if (!resultado.ok) {
      set({ feedback: resultado.mensagem });
      return false;
    }
    const novo = resultado.state;
    // "Livres" no HUD = soldados que ainda podem receber um job.
    novo.turno.acoesRestantes = soldadosDisponiveis(novo, novo.jogadorId).length;
    novo.status = avaliarStatus(novo);
    if (novo.status === 'vitoria') {
      addLog(novo, 'fim', 'Você dominou toda a Zona Sul. VITÓRIA.');
    }
    set({ game: novo, feedback: resultado.mensagem });
    void salvarJogo(novo);
    return true;
  }

  /** Guard comum: precisa ter partida em andamento. */
  function ativo(): GameState | null {
    const game = get().game;
    return game && game.status === 'em_andamento' ? game : null;
  }

  return {
    game: null,
    feedback: null,
    flash: { cor: null, seq: 0 },
    temSave: false,

    novoJogo() {
      const game = criarPartida();
      set({ game, feedback: null, temSave: true });
      void salvarJogo(game);
    },

    async carregar() {
      const game = await carregarJogo();
      if (game) {
        set({ game, feedback: null, temSave: true });
        return true;
      }
      return false;
    },

    async verificarSave() {
      const game = await carregarJogo();
      set({ temSave: !!game });
    },

    sairParaMenu() {
      set({ game: null, feedback: null });
    },

    limparFeedback() {
      set({ feedback: null });
    },

    moverSoldado(soldadoId, destinoId) {
      const game = ativo();
      if (!game) return;
      aplicar(moverSoldadoEngine(game, soldadoId, destinoId));
    },

    venderNoBairro(soldadoId) {
      const game = ativo();
      if (!game) return;
      aplicar(venderNoBairroEngine(game, game.jogadorId, soldadoId));
    },

    protegerBairro(soldadoId) {
      const game = ativo();
      if (!game) return;
      aplicar(protegerBairroEngine(game, game.jogadorId, soldadoId));
    },

    sondarBairro(soldadoId, alvoId) {
      const game = ativo();
      if (!game) return;
      aplicar(sondarComSoldado(game, game.jogadorId, soldadoId, alvoId));
    },

    invadirBairro(soldadoId, alvoId) {
      const game = ativo();
      if (!game) return;
      const resultado = invadirComSoldado(game, game.jogadorId, soldadoId, alvoId);
      const ok = aplicar(resultado);
      if (ok) {
        // Flash: verde se tomamos o bairro, vermelho se fomos repelidos.
        const dono = bairroDe(resultado.state, alvoId)?.dono;
        const cor = dono === game.jogadorId ? 'vitoria' : 'derrota';
        set((s) => ({ flash: { cor, seq: s.flash.seq + 1 } }));
      }
    },

    comprarArma(armaId, soldadoId) {
      const game = ativo();
      if (!game) return;
      aplicar(comprarArmaEngine(game, game.jogadorId, armaId, soldadoId));
    },

    recrutarSoldado(bairroId) {
      const game = ativo();
      if (!game) return;
      aplicar(recrutarSoldadoEngine(game, game.jogadorId, bairroId));
    },

    construirBoca(bairroId) {
      const game = ativo();
      if (!game) return;
      aplicar(construirBocaEngine(game, game.jogadorId, bairroId));
    },

    contratarAdvogado() {
      const game = ativo();
      if (!game) return;
      aplicar(contratarAdvogadoEngine(game, game.jogadorId));
    },

    passarTurno() {
      const game = ativo();
      if (!game) return;

      let s: GameState = clonar(game);
      s.turno.fase = 'ia';

      // Fase da IA: reseta os jobs dela e cada rival age (tropa ociosa fica em guarda).
      for (const ia of iasDe(s)) {
        resetarJobs(s, ia.id);
        s = executarTurnoIA(s, ia.id);
      }

      // Polícia age sobre quem está com calor alto; renda + decaimento de calor.
      aplicarBatidaPolicial(s);
      aplicarRenda(s);
      s.turno.numero += 1;
      // Novo turno do jogador: libera os jobs de todos os soldados dele.
      resetarJobs(s, s.jogadorId);
      s.turno.acoesRestantes = soldadosDisponiveis(s, s.jogadorId).length;
      s.turno.fase = 'decisao';
      limparIntelExpirado(s);

      s.status = avaliarStatus(s);
      if (s.status === 'vitoria') {
        addLog(s, 'fim', 'Você dominou toda a Zona Sul. VITÓRIA.');
      } else if (s.status === 'derrota') {
        addLog(s, 'fim', 'Perdeu todo território e todas as tropas. DERROTA.');
      } else {
        addLog(s, 'ia', `— Relatório do turno ${s.turno.numero} —`);
      }

      set({ game: s, feedback: null });
      void salvarJogo(s);
    },
  };
});
