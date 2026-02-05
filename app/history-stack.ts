import { Action, HistoryStackInterface } from "@/types/history-stack";

export class HistoryStack implements HistoryStackInterface {
  actions: Action[] = [];
  currentIndex: number = -1;

  push(action: Action): void {
    // Remove any actions after the current index
    this.actions = this.actions.slice(0, this.currentIndex + 1);
    this.actions.push(action);
    this.currentIndex++;
  }

  undo(): Action | null {
    if (this.currentIndex < 0) return null;
    const action = this.actions[this.currentIndex];
    this.currentIndex--;
    return action;
  }

  redo(): Action | null {
    if (this.currentIndex + 1 >= this.actions.length) return null;
    this.currentIndex++;
    return this.actions[this.currentIndex];
  }

  clear(): void {
    this.actions = [];
    this.currentIndex = -1;
  }

  copy(): HistoryStack {
    const newStack = new HistoryStack();
    newStack.actions = [...this.actions];
    newStack.currentIndex = this.currentIndex;
    return newStack;
  }
}
