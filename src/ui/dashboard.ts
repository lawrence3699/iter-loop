import blessed from "blessed";

interface AgentInfo {
  id: string;
  label: string;
  state: "working" | "waiting_input" | "idle" | "blocked";
}

interface Message {
  from: string;
  text: string;
  timestamp: string;
}

/**
 * Simple blessed dashboard for monitoring loop agents.
 * Layout: agent list panel (left) + message panel (right) + status bar (bottom).
 */
export class Dashboard {
  private screen: blessed.Widgets.Screen | null = null;
  private agentList: blessed.Widgets.ListElement | null = null;
  private messageBox: blessed.Widgets.BoxElement | null = null;
  private statusBar: blessed.Widgets.BoxElement | null = null;
  private agents: AgentInfo[] = [];
  private messages: Message[] = [];

  start(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "loop dashboard",
    });

    // Agent list panel (left, 30% width)
    this.agentList = blessed.list({
      parent: this.screen,
      label: " Agents ",
      left: 0,
      top: 0,
      width: "30%",
      height: "100%-1",
      border: { type: "line" },
      style: {
        border: { fg: "cyan" },
        selected: { bg: "blue" },
        item: { fg: "white" },
      },
      keys: true,
      vi: true,
      scrollable: true,
      items: [],
    });

    // Message panel (right, 70% width)
    this.messageBox = blessed.box({
      parent: this.screen,
      label: " Messages ",
      left: "30%",
      top: 0,
      width: "70%",
      height: "100%-1",
      border: { type: "line" },
      style: {
        border: { fg: "cyan" },
        label: { fg: "cyan" },
      },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      content: "{gray-fg}No messages yet{/gray-fg}",
    });

    // Status bar (bottom)
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      style: {
        bg: "blue",
        fg: "white",
      },
      tags: true,
      content: " loop dashboard | q: quit | tab: switch focus",
    });

    // Keybindings
    this.screen.key(["q", "C-c"], () => {
      this.stop();
    });

    this.screen.key(["tab"], () => {
      if (this.agentList && this.messageBox) {
        if ((this.screen as blessed.Widgets.Screen).focused === this.agentList) {
          this.messageBox.focus();
        } else {
          this.agentList.focus();
        }
        this.screen?.render();
      }
    });

    this.agentList.focus();
    this.screen.render();
  }

  stop(): void {
    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }
  }

  /** Update the agent list display. */
  updateAgents(agents: AgentInfo[]): void {
    this.agents = agents;
    if (!this.agentList) return;

    const items = this.agents.map((a) => {
      const marker = stateMarker(a.state);
      return `${marker} ${a.label}`;
    });

    this.agentList.setItems(items);
    this.screen?.render();
  }

  /** Append a message to the message panel. */
  addMessage(msg: Message): void {
    this.messages.push(msg);
    if (!this.messageBox) return;

    const lines = this.messages
      .slice(-100) // Keep last 100 messages
      .map(
        (m) =>
          `{gray-fg}${m.timestamp}{/gray-fg} {cyan-fg}${m.from}{/cyan-fg}: ${m.text}`,
      );

    this.messageBox.setContent(lines.join("\n"));
    this.messageBox.setScrollPerc(100);
    this.screen?.render();
  }

  /** Update the status bar text. */
  setStatus(text: string): void {
    if (!this.statusBar) return;
    this.statusBar.setContent(` ${text}`);
    this.screen?.render();
  }
}

function stateMarker(state: AgentInfo["state"]): string {
  switch (state) {
    case "working":
      return "{green-fg}*{/green-fg}";
    case "waiting_input":
      return "{yellow-fg}?{/yellow-fg}";
    case "blocked":
      return "{red-fg}!{/red-fg}";
    case "idle":
    default:
      return "{gray-fg}-{/gray-fg}";
  }
}
