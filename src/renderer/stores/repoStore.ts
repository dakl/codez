import type { RepoInfo } from "@shared/types";
import { create } from "zustand";

interface RepoState {
  repos: RepoInfo[];
  selectedRepoPath: string | null;

  loadRepos: () => Promise<void>;
  selectRepo: (repoPath: string) => void;
  addRepoViaDialog: () => Promise<RepoInfo | null>;
  removeRepo: (repoPath: string) => Promise<void>;
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repos: [],
  selectedRepoPath: null,

  loadRepos: async () => {
    if (!window.electronAPI) return;
    const repos = await window.electronAPI.listRepos();
    set({ repos });
    // Auto-select first repo if none selected
    if (!get().selectedRepoPath && repos.length > 0) {
      set({ selectedRepoPath: repos[0].path });
    }
  },

  selectRepo: (repoPath) => {
    set({ selectedRepoPath: repoPath });
  },

  addRepoViaDialog: async () => {
    if (!window.electronAPI) return null;
    const repo = await window.electronAPI.selectRepoDialog();
    if (repo) {
      set((state) => ({
        repos: [repo, ...state.repos.filter((r) => r.path !== repo.path)],
        selectedRepoPath: repo.path,
      }));
    }
    return repo;
  },

  removeRepo: async (repoPath) => {
    if (!window.electronAPI) return;
    await window.electronAPI.removeRepo(repoPath);
    set((state) => ({
      repos: state.repos.filter((r) => r.path !== repoPath),
      selectedRepoPath: state.selectedRepoPath === repoPath ? null : state.selectedRepoPath,
    }));
  },
}));
