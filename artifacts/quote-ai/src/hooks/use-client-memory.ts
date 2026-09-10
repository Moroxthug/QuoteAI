import { useState, useCallback } from "react";

export interface SavedClient {
  id: string;
  nome: string;
  indirizzo?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  businessNumber?: string;
  partitaIva?: string;
  lastUsed: number;
}

const STORAGE_KEY = "quoteai:clients";
const MAX_SAVED = 10;

function loadClients(): SavedClient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedClient[];
  } catch {
    return [];
  }
}

function persist(clients: SavedClient[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function useClientMemory() {
  const [clients, setClients] = useState<SavedClient[]>(() => loadClients());

  const upsertClient = useCallback((data: Omit<SavedClient, "id" | "lastUsed">) => {
    if (!data.nome.trim()) return;
    setClients(prev => {
      const idx = prev.findIndex(
        c => c.nome.toLowerCase().trim() === data.nome.toLowerCase().trim()
      );
      let updated: SavedClient[];
      if (idx >= 0) {
        updated = prev.map((c, i) =>
          i === idx ? { ...c, ...data, lastUsed: Date.now() } : c
        );
      } else {
        const newClient: SavedClient = {
          ...data,
          id: crypto.randomUUID(),
          lastUsed: Date.now(),
        };
        updated = [newClient, ...prev].slice(0, MAX_SAVED);
      }
      persist(updated);
      return updated;
    });
  }, []);

  const removeClient = useCallback((id: string) => {
    setClients(prev => {
      const updated = prev.filter(c => c.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const sorted = [...clients].sort((a, b) => b.lastUsed - a.lastUsed);
  return { clients: sorted, upsertClient, removeClient };
}
