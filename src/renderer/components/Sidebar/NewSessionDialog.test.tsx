// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewSessionDialog } from "./NewSessionDialog";

// Mock window.electronAPI — the dialog calls getSettings and listBranches/getDefaultBranch on mount
const mockElectronAPI = {
  getSettings: vi.fn().mockResolvedValue({ commandProfiles: [] }),
  listBranches: vi.fn().mockResolvedValue(["main"]),
  getDefaultBranch: vi.fn().mockResolvedValue("main"),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

describe("NewSessionDialog", () => {
  it("calls onConfirm exactly once when Enter is pressed with empty branch name (main branch)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(<NewSessionDialog repoName="my-repo" repoPath="/repos/my-repo" onConfirm={onConfirm} onCancel={onCancel} />);

    // The input is auto-focused; press Enter without typing a branch name
    const input = screen.getByPlaceholderText("Branch name (optional)");
    await user.click(input);
    await user.keyboard("{Enter}");

    // onConfirm should be called exactly once — not twice due to event bubbling
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ profileId: undefined });
  });

  it("calls onConfirm exactly once when the Create button is clicked with empty branch name", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<NewSessionDialog repoName="my-repo" repoPath="/repos/my-repo" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
