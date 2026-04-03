import { Injectable } from "@nestjs/common";

type DirtyListener = (symbols: string[]) => void;

@Injectable()
export class SignalChangeService {
  private readonly listeners = new Set<DirtyListener>();

  markDirty(symbols: string[]) {
    const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean))];
    if (unique.length === 0) {
      return;
    }

    for (const listener of this.listeners) {
      listener(unique);
    }
  }

  subscribe(listener: DirtyListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
