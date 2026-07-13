/**
 * Save/load da partida via AsyncStorage. GameState é JSON puro, então
 * serializa direto. Chave versionada pra permitir migração futura.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState } from '../types/game';

const SAVE_KEY = 'empire:save:v1';

export async function salvarJogo(state: GameState): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Falha ao salvar partida:', e);
  }
}

export async function carregarJogo(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Sanidade mínima: precisa ter cidade e facções.
    if (!parsed?.cidade || !Array.isArray(parsed.faccoes)) return null;
    // Backfill de campos adicionados em versões novas (saves antigos).
    if (!Array.isArray(parsed.intel)) parsed.intel = [];
    if (typeof parsed.recrutaSeq !== 'number') parsed.recrutaSeq = 0;
    if (typeof parsed.dificuldade !== 'string') parsed.dificuldade = 'normal';
    if (parsed.ultimoRelatorio === undefined) parsed.ultimoRelatorio = null;
    if (!Array.isArray(parsed.mercado)) parsed.mercado = [];
    for (const b of parsed.cidade.bairros ?? []) {
      if (typeof b.producao !== 'number') b.producao = 0;
      // Economia (Respect): demanda + estabilidade. Saves antigos derivam demanda do valorBase.
      if (typeof b.demanda !== 'number') b.demanda = Math.max(8, Math.round((b.valorBase ?? 800) / 100));
      if (typeof b.estabilidade !== 'number') b.estabilidade = 1;
    }
    // Campos de personagem/jobs (Respect 2): patente, importante, mortes, job, corre, colete.
    for (const f of parsed.faccoes) {
      if (!Array.isArray(f.veiculos)) f.veiculos = [];
      if (typeof f.stash !== 'number') f.stash = 0;
      for (const s of f.soldados ?? []) {
        if (typeof s.patente !== 'string') s.patente = 'soldado';
        if (typeof s.importante !== 'boolean') s.importante = s.patente !== 'soldado';
        if (typeof s.mortes !== 'number') s.mortes = 0;
        if (typeof s.corre !== 'number') s.corre = 4;
        if (typeof s.edge !== 'number') s.edge = 0;
        if (typeof s.colete !== 'boolean') s.colete = false;
        if (s.jobAtual === undefined) s.jobAtual = null;
        if (typeof s.agiuNoTurno !== 'boolean') s.agiuNoTurno = false;
      }
    }
    return parsed;
  } catch (e) {
    console.warn('Falha ao carregar partida:', e);
    return null;
  }
}

export async function existeSave(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    return !!raw;
  } catch {
    return false;
  }
}

export async function apagarSave(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('Falha ao apagar save:', e);
  }
}
