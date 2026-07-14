import { create } from "zustand";
import type { MeetingType, MeetingTypeInput } from "../lib/types";
import * as api from "../lib/tauri";

interface MeetingTypesState {
  types: MeetingType[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (input: MeetingTypeInput) => Promise<MeetingType>;
  update: (mt: MeetingType) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMeetingTypesStore = create<MeetingTypesState>((set, get) => ({
  types: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ types: await api.listMeetingTypes(), loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (input) => {
    const mt = await api.createMeetingType(input);
    set({ types: [...get().types, mt] });
    return mt;
  },

  update: async (mt) => {
    await api.updateMeetingType(mt);
    set({ types: get().types.map((t) => (t.id === mt.id ? mt : t)) });
  },

  remove: async (id) => {
    await api.deleteMeetingType(id);
    set({ types: get().types.filter((t) => t.id !== id) });
  },
}));
