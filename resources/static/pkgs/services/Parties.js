import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps";
import Html from "/libs/html.js";

let root;
let Ui;
let Users;
let Sfx;

const activeParties = new Map();
let activeGame = {
  gameName: "Terebi Game",
  activeParty: null,
  registered: false,
  pid: null,
};

const overlayState = {
  container: null,
  panels: [],
  originalUi: null,
};

const createPanel = (container, { width = "26%", height = "95%" } = {}) => {
  const panel = new Html("div").appendTo(container).styleJs({
    backgroundColor: "var(--background-default)",
    border: "0.1rem solid var(--background-lighter)",
    boxShadow: "0 0 0.5rem 0 var(--current-player)",
    borderRadius: "0.8rem",
    backdropFilter: "blur(0.5rem) brightness(0.5) contrast(1.05)",
    width,
    height,
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    overflow: "scroll",
    scrollBehavior: "smooth",
    gap: "10px",
  });

  Ui.transition("popIn", panel);
  return panel;
};

const closePanel = (panelToClose) => {
  Sfx.playSfx("deck_ui_hide_modal.wav");
  Ui.transition("popOut", panelToClose);

  setTimeout(() => {
    panelToClose.cleanup();

    overlayState.panels = overlayState.panels.filter(
      (p) => p.panel !== panelToClose,
    );

    if (overlayState.panels.length === 0) {
      overlayState.container.cleanup();
      overlayState.container = null;
      const { pid, prevType, prevLayout, prevCallback } =
        overlayState.originalUi;
      Ui.init(pid, prevType, prevLayout, prevCallback);
      overlayState.originalUi = null;
    } else {
      const lastPanel = overlayState.panels[overlayState.panels.length - 1];
      const { type, lists, callback } = lastPanel.ui;
      Ui.init(activeGame.pid, type, lists, callback);
    }
  }, 200);
};

const showProfilePanel = (friend) => {
  const panel = createPanel(overlayState.container, { height: "auto" });

  const statusText =
    friend.status === 1
      ? "Online"
      : `Offline - Last seen: ${new Date(
          friend.lastOnline,
        ).toLocaleDateString()}`;

  const statusColor = friend.status === 1 ? "#4CAF50" : "#6c757d";

  const headingContainer = new Html("div")
    .appendTo(panel)
    .styleJs({ display: "flex", alignItems: "center", gap: "12px" });
  new Html("h1").text(friend.name).appendTo(headingContainer);
  new Html("div")
    .styleJs({
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      backgroundColor: statusColor,
      flexShrink: 0,
    })
    .appendTo(headingContainer);

  new Html("p")
    .text(statusText)
    .styleJs({ margin: "0 0 10px 0" })
    .appendTo(panel);

  new Html("br").appendTo(panel);

  const buttonContainer = new Html("div")
    .class("flex-list")
    .appendTo(panel)
    .styleJs({ flexDirection: "column" });

  const inviteButton = new Html("button")
    .text("Invite to Party")
    .appendTo(buttonContainer)
    .styleJs({ width: "100%" })
    .on("click", () => {
      console.log(`[PARTIES] TODO: Implement invite logic for ${friend.name}`);
      Sfx.playSfx("deck_ui_launch_game.wav");
    });

  const chatButton = new Html("button")
    .text("Chat")
    .appendTo(buttonContainer)
    .styleJs({ width: "100%" })
    .on("click", () => {
      console.log(`[PARTIES] TODO: Implement chat logic for ${friend.name}`);
      Sfx.playSfx("deck_ui_misc_sfx.wav");
    });

  const uiType = "horizontal";
  const uiElements = [[inviteButton.elm], [chatButton.elm]];
  const callback = (evt) => {
    if (evt === "back") {
      closePanel(panel);
    }
  };

  overlayState.panels.push({
    panel,
    ui: { type: uiType, lists: uiElements, callback },
  });
  Ui.init(activeGame.pid, uiType, uiElements, callback);
};

let onOverlayOpen = async (e) => {
  if (!overlayState.container) {
    Sfx.playSfx("deck_ui_show_modal.wav");
    const currentUi = Ui.get(activeGame.pid);
    overlayState.originalUi = {
      pid: activeGame.pid,
      prevLayout: currentUi.lists,
      prevCallback: currentUi.parentCallback || (() => {}),
      prevType: currentUi.type,
    };

    overlayState.container = new Html("div").appendTo("body").styleJs({
      zIndex: 2147483647,
      backgroundColor: "rgba(0,0,0,0.5)",
      width: "100%",
      height: "100%",
      top: "0",
      left: "0",
      position: "absolute",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "4rem",
      gap: "2rem",
    });
  }

  const panel = createPanel(overlayState.container);
  const ws = root.Security.getSecureVariable("CHERRY_TREE_WS");
  const friends = ws
    ? (await ws.sendMessage({ type: "get-friends" })).result
    : [];

  const headingContents = new Html("div")
    .appendTo(panel)
    .styleJs({ display: "flex", flexDirection: "column", gap: "10px" });
  new Html("h1").text("Social Hub").appendTo(headingContents);
  new Html("p")
    .html(`Currently playing: <strong>${activeGame.gameName}</strong>`)
    .appendTo(headingContents);
  new Html("br").appendTo(panel);
  new Html("h2")
    .text("Your friends")
    .appendTo(panel)
    .styleJs({ paddingBottom: "10px" });

  const uiType = "horizontal";
  let uiElements = [];
  if (friends.length > 0) {
    friends.forEach((friend) => {
      const row = new Html("button")
        .class("flex-list")
        .appendTo(panel)
        .styleJs({
          width: "100%",
          display: "flex",
        })
        .on("click", () => {
          row.classOff("over");
          Sfx.playSfx("deck_ui_navigation.wav");
          showProfilePanel(friend);
        });

      const nameContainer = new Html("div").appendTo(row).styleJs({
        display: "flex",
        alignItems: "center",
        gap: "10px",
      });

      new Html("div")
        .styleJs({
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: friend.status === 1 ? "#4CAF50" : "#6c757d",
          flexShrink: 0,
        })
        .appendTo(nameContainer);

      new Html("span").text(friend.name).appendTo(nameContainer);

      uiElements.push([row.elm]);
    });
  } else {
    new Html("button")
      .text("You don't have a friend yet!")
      .class("flex-list")
      .appendTo(panel)
      .styleJs({ width: "100%" });
  }

  const callback = (evt) => {
    if (evt === "back") {
      closePanel(panel);
    }
  };

  overlayState.panels.push({
    panel,
    ui: { type: uiType, lists: uiElements, callback },
  });
  Ui.init(activeGame.pid, uiType, uiElements, callback);
};

const generateHostCode = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
  let code = "terebiParty-";
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const pkg = {
  name: "Parties",
  svcName: "PartySvc",
  type: "svc",
  privs: 0,
  start: async function (Root) {
    console.log("Hello from Parties service.", Root);
    Ui = Root.Processes.getService("UiLib").data;
    Users = Root.Processes.getService("UserSvc").data;
    Sfx = Root.Processes.getService("SfxLib").data;
    root = Root;
  },
  data: {
    registerGame(gameData) {
      if (gameData.name && typeof gameData.name == "string") {
        activeGame.gameName = gameData.name;
      }
      if (!gameData.pid) {
        throw new Error("Process ID is required for overlay support!");
      }
      activeGame.pid = gameData.pid;
      activeGame.registered = true;
      document.addEventListener(
        "CherryTree.Parties.Overlay.Open",
        onOverlayOpen,
      );
    },
    unregisterGame() {
      for (const [hostCode, party] of activeParties.entries()) {
        if (party && party.peer && !party.peer.destroyed) {
          party.peer.destroy();
        }
        activeParties.delete(hostCode);
        console.log(`[PARTIES] Ended party: ${hostCode}`);
      }
      activeGame = {
        gameName: "Terebi Game",
        activeParty: null,
        registered: false,
        pid: null,
      };
      document.removeEventListener(
        "CherryTree.Parties.Overlay.Open",
        onOverlayOpen,
      );
    },
    createParty(partyName = "Terebi Party") {
      return new Promise((resolve, reject) => {
        if (!activeGame.registered) {
          reject(new Error("The game must be registered!"));
        }
        const hostCode = generateHostCode();
        const negotiatorPeer = new Peer(hostCode, {
          config: {
            iceServers: [
              {
                urls: "turn:freestun.net:3478",
                username: "free",
                credential: "free",
              },
            ],
          },
        });

        negotiatorPeer.on("open", (id) => {
          if (id !== hostCode) {
            console.warn(
              `[PARTIES] PeerJS assigned a different ID: ${id}. This may happen if the original ID was taken.`,
            );
          }

          const party = {
            partyName,
            hostCode,
            peer: negotiatorPeer,
            peers: [],
          };

          activeParties.set(hostCode, party);
          console.log("[PARTIES] Party created successfully:", {
            partyName,
            hostCode,
          });

          resolve({
            partyName,
            hostCode,
            endParty: () => {
              const p = activeParties.get(hostCode);
              if (p && p.peer && !p.peer.destroyed) {
                p.peer.destroy();
              }
              activeParties.delete(hostCode);
              console.log(`[PARTIES] Ended party: ${hostCode}`);
            },
          });
        });

        negotiatorPeer.on("error", (err) => {
          console.error("[PARTIES] PeerJS connection error:", err);
          reject(err);
        });

        negotiatorPeer.on("connection", (conn) => {
          console.log(`[PARTIES] Incoming connection from ${conn.peer}`);
        });
      });
    },
    endParty(hostCode) {
      const party = activeParties.get(hostCode);
      if (party && party.peer && !party.peer.destroyed) {
        party.peer.destroy();
      }
      activeParties.delete(hostCode);
      console.log(`[PARTIES] Ended party: ${hostCode}`);
    },
    getPartyInfo(hostCode) {
      const party = activeParties.get(hostCode);
      if (party) {
        return {
          partyName: party.partyName,
          hostCode: party.hostCode,
        };
      }
      return undefined;
    },

    getParty(hostCode) {
      return activeParties.get(hostCode);
    },
  },

  end: async function () {
    console.log("[PARTIES] Shutting down all party connections.");
    for (const [hostCode, party] of activeParties.entries()) {
      if (party.peer && !party.peer.destroyed) {
        party.peer.destroy();
        console.log(`[PARTIES] Destroyed party: ${hostCode}`);
      }
    }
    activeParties.clear();
    console.log("[PARTIES] Shutdown complete.");
  },
};

export default pkg;
