import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps";
import settingsLib from "../../libs/settingsLib.js";
import icons from "../../libs/icons.js";
import Html from "/libs/html.js";

let root;
let Ui;
let Users;
let Sfx;
let socket;

let partyServer = "http://localhost:5501/";
let livekitServer = "wss://terebi-phgeum6f.livekit.cloud";

let activeParty = null;
let activeRoom = null;
let activeGame = {
  gameName: "Terebi Game",
  activeParty: null,
  registered: false,
  pid: null,
};

let partyList = [];

const overlayState = {
  container: null,
  panels: [],
  originalUi: null,
};

let currentToast = null;

const showSocialHubToast = (toastData) => {
  if (currentToast) {
    currentToast.cleanup();
    currentToast = null;
  }

  const toast = new Html("div").appendTo("body").styleJs({
    position: "fixed",
    bottom: "5%",
    left: "50%",
    zIndex: 2147483647,
    borderRadius: "1rem",
    overflow: "hidden",
    boxShadow:
      "0 0 1rem 0 var(--current-player), 0 0.4rem 1.2rem 0 rgba(0,0,0,0.3)",
    width: "480px",
    transform: "translateX(-50%) translateY(150%)",
    transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
    color: "white",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  });

  const topSection = new Html("div").appendTo(toast).styleJs({
    display: "flex",
    alignItems: "center",
    gap: "1.25rem",
    padding: "1.25rem",
    backgroundColor: "var(--background-light)",
  });

  const iconContainer = new Html("div").appendTo(topSection).styleJs({
    width: "56px",
    height: "56px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.375rem",
  });

  new Html("div").html(toastData.icon).appendTo(iconContainer).styleJs({
    width: "32px",
    height: "32px",
    margin: 0,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const textContainer = new Html("div").appendTo(topSection);

  new Html("h3").text(toastData.title).appendTo(textContainer).styleJs({
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "600",
    textShadow: "0 1px 2px rgba(0,0,0,0.2)",
  });

  new Html("p").html(toastData.subtitle).appendTo(textContainer).styleJs({
    margin: 0,
    fontSize: "1rem",
    opacity: 0.9,
  });

  const bottomSection = new Html("div").appendTo(toast).styleJs({
    padding: "0.8rem 1.25rem",
    backgroundColor: "var(--background-default)",
  });

  new Html("span").html(toastData.hint).appendTo(bottomSection).styleJs({
    fontSize: "0.9rem",
  });

  setTimeout(() => {
    toast.styleJs({ transform: "translateX(-50%) translateY(0)" });
  }, 100);

  setTimeout(() => {
    toast.styleJs({ transform: "translateX(-50%) translateY(150%)" });
  }, 5000);

  setTimeout(() => {
    toast.cleanup();
    if (currentToast === toast) currentToast = null;
  }, 5600);

  currentToast = toast;
};

const createPanel = (
  container,
  { width = "28%", height = "95%", onClose = () => {} } = {},
) => {
  const panel = new Html("div").appendTo(container).styleJs({
    backgroundColor: "var(--background-darker)",
    border: "0.1rem solid var(--background-lighter)",
    boxShadow:
      "0 0 1rem 0 var(--current-player), 0 0.4rem 1.2rem 0 rgba(0,0,0,0.3)",
    borderRadius: "0.8rem",
    backdropFilter: "blur(0.5rem) brightness(0.7)",
    width,
    height,
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overflowX: "hidden",
    scrollBehavior: "smooth",
    gap: "1rem",
  });

  panel.onClose = onClose;

  Ui.transition("popIn", panel);
  return panel;
};

const closePanel = (panelToClose) => {
  Sfx.playSfx("deck_ui_hide_modal.wav");
  Ui.transition("popOut", panelToClose);

  if (typeof panelToClose.onClose === "function") {
    panelToClose.onClose();
  }

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

const showSettingsPanel = async () => {
  Sfx.playSfx("deck_ui_navigation.wav");

  let localStream = null;
  let audioContext = null;
  let animationFrameId = null;
  let latestCallId = 0;

  const cleanupPreview = () => {
    latestCallId++;
    console.log("[PARTIES PREVIEW] Cleanup initiated...");

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStream = null;
    }
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close();
      audioContext = null;
    }
    document.removeEventListener("CherryTree.Comms.Audio.Update", startPreview);
    document.removeEventListener("CherryTree.Comms.Video.Update", startPreview);
  };

  const panel = createPanel(overlayState.container, {
    width: "32%",
    height: "auto",
    onClose: cleanupPreview,
  });

  const headingContainer = new Html("div")
    .appendTo(panel)
    .styleJs({ display: "flex", alignItems: "center", gap: "1rem" });
  new Html("h1")
    .text("Settings")
    .styleJs({ textShadow: "0 1px 3px rgba(0,0,0,0.5)" })
    .appendTo(headingContainer);
  new Html("p")
    .text("Configure communications settings")
    .styleJs({ margin: "0 0 1.5rem 0", color: "#adb5bd" })
    .appendTo(panel);

  const previewContainer = new Html("div").appendTo(panel).styleJs({
    width: "100%",
    aspectRatio: "16 / 9",
    backgroundColor: "#000",
    borderRadius: "0.5rem",
    marginBottom: "1rem",
    overflow: "hidden",
    position: "relative",
  });

  const videoPreview = new Html("video").appendTo(previewContainer).styleJs({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "none",
  });
  videoPreview.elm.muted = true;
  videoPreview.elm.playsInline = true;

  const placeholderText = new Html("div").appendTo(previewContainer).styleJs({
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6c757d",
    padding: "1rem",
    textAlign: "center",
  });
  const audioMeterContainer = new Html("div").appendTo(panel).styleJs({
    height: "1rem",
    backgroundColor: "var(--background-light)",
    borderRadius: "0.5rem",
    marginBottom: "1rem",
    overflow: "hidden",
  });
  const audioMeterBar = new Html("div").appendTo(audioMeterContainer).styleJs({
    width: "0%",
    height: "100%",
    backgroundColor: "#1be350",
    transition: "width 0.1s linear",
  });

  const startPreview = async () => {
    latestCallId++;
    const currentCallId = latestCallId;

    placeholderText.text("Loading...").style({ display: "flex" });
    videoPreview.style({ display: "none" });

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close();
    }

    audioMeterBar.style({ width: "0%" });

    const audioDeviceId = await window.localforage.getItem(
      "settings__audioInput",
    );
    const videoDeviceId = await window.localforage.getItem(
      "settings__videoInput",
    );

    if (!audioDeviceId && !videoDeviceId) {
      if (currentCallId === latestCallId)
        placeholderText.text("No devices selected");
      return;
    }

    const constraints = {
      audio: audioDeviceId
        ? {
            deviceId: { exact: audioDeviceId },
            echoCancellation: true,
            noiseSuppression: true,
          }
        : false,
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : false,
    };

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (currentCallId !== latestCallId) {
        newStream.getTracks().forEach((track) => track.stop());
        console.log(
          `[PARTIES PREVIEW] Stale call (ID ${currentCallId}) resolved. Discarding stream.`,
        );
        return;
      }

      localStream = newStream;

      const newVideoTrack = localStream.getVideoTracks()[0];
      if (newVideoTrack) {
        placeholderText.style({ display: "none" });
        videoPreview.style({ display: "block" });
        videoPreview.elm.srcObject = localStream;

        videoPreview.elm.addEventListener(
          "loadedmetadata",
          async () => {
            if (currentCallId !== latestCallId) return;
            try {
              await videoPreview.elm.play();
            } catch (playError) {
              videoPreview.style({ display: "none" });
              placeholderText
                .text("Error: Could not play video preview.")
                .style({ display: "flex" });
            }
          },
          { once: true },
        );
      } else {
        placeholderText.text("No video device selected");
      }

      if (localStream.getAudioTracks().length > 0) {
        audioContext = new AudioContext();
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        const source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyserNode);
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const draw = () => {
          if (
            currentCallId !== latestCallId ||
            !audioContext ||
            audioContext.state === "closed"
          )
            return;
          analyserNode.getByteTimeDomainData(dataArray);
          let sumSquares = 0.0;
          for (const amplitude of dataArray) {
            const val = amplitude / 128.0 - 1.0;
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const volumePercent = rms * 200;
          audioMeterBar.style({ width: `${Math.min(100, volumePercent)}%` });
          animationFrameId = requestAnimationFrame(draw);
        };
        draw();
      }
    } catch (err) {
      if (currentCallId !== latestCallId) {
        console.log(
          `[PARTIES PREVIEW] Stale call (ID ${currentCallId}) threw an error, ignoring.`,
        );
        return;
      }
      console.error(
        "[PARTIES PREVIEW] Error starting preview stream (getUserMedia):",
        err,
      );
      videoPreview.style({ display: "none" });
      placeholderText
        .text("Error accessing media devices. Ensure permissions are granted.")
        .style({ display: "flex" });
    }
  };

  document.addEventListener("CherryTree.Comms.Audio.Update", startPreview);
  document.addEventListener("CherryTree.Comms.Video.Update", startPreview);

  startPreview();

  let uiElements = [];
  const buttonContainer = new Html("div")
    .class("flex-list")
    .appendTo(panel)
    .styleJs({ flexDirection: "column", gap: "10px", marginTop: "1rem" });
  const audioButton = new Html("button")
    .text(`Set audio input device`)
    .appendTo(buttonContainer)
    .styleJs({ width: "100%" })
    .on("click", () => {
      settingsLib.audioInputSelection(activeGame.pid, overlayState.container);
    });
  const videoButton = new Html("button")
    .text(`Set video input device`)
    .appendTo(buttonContainer)
    .styleJs({ width: "100%" })
    .on("click", () => {
      settingsLib.videoInputSelection(activeGame.pid, overlayState.container);
    });
  uiElements = [[audioButton.elm], [videoButton.elm]];
  const uiType = "horizontal";
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
const showProfilePanel = (friend) => {
  Sfx.playSfx("deck_ui_navigation.wav");
  const panel = createPanel(overlayState.container, {
    width: "28%",
    height: "auto",
  });

  const statusText =
    friend.status === 1
      ? "Online"
      : `Offline - Last seen: ${new Date(
          friend.lastOnline,
        ).toLocaleDateString()}`;

  const statusColor = friend.status === 1 ? "#1be350" : "#6c757d";

  const headingContainer = new Html("div")
    .appendTo(panel)
    .styleJs({ display: "flex", alignItems: "center", gap: "1rem" });
  new Html("h1")
    .text(friend.name)
    .styleJs({ textShadow: "0 1px 3px rgba(0,0,0,0.5)" })
    .appendTo(headingContainer);
  new Html("div")
    .styleJs({
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      backgroundColor: statusColor,
      flexShrink: "0",
      border: "2px solid rgba(255, 255, 255, 0.7)",
    })
    .appendTo(headingContainer);

  new Html("p")
    .text(statusText)
    .styleJs({ margin: "0 0 1.5rem 0", color: "#adb5bd" })
    .appendTo(panel);

  let uiElements = [];

  const buttonContainer = new Html("div")
    .class("flex-list")
    .appendTo(panel)
    .styleJs({ flexDirection: "column", gap: "10px" });

  if (
    activeGame.activeParty &&
    activeParty &&
    activeParty.peer &&
    activeParty.peer.id === activeParty.hostCode &&
    !friend.joined
  ) {
    const inviteButton = new Html("button")
      .text(`Invite to ${activeGame.activeParty.partyName}`)
      .appendTo(buttonContainer)
      .styleJs({ width: "100%" })
      .on("click", () => {
        console.log(
          `[PARTIES] Inviting ${friend.name} to ${activeParty.partyName}`,
        );
        if (socket) {
          socket.emit("invite", {
            hostCode: activeParty.hostCode,
            user: friend,
            packageName: activeGame.packageName,
          });
        }
        Sfx.playSfx("deck_ui_launch_game.wav");
      });
    uiElements.push([inviteButton.elm]);
  }

  const chatButton = new Html("button")
    .text("Chat")
    .appendTo(buttonContainer)
    .styleJs({ width: "100%" })
    .on("click", () => {
      console.log(`[PARTIES] TODO: Implement chat logic for ${friend.name}`);
      Sfx.playSfx("deck_ui_misc_sfx.wav");
    });
  uiElements.push([chatButton.elm]);

  const uiType = "horizontal";
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
  if (overlayState.container) {
    return;
  }

  Sfx.playSfx("deck_ui_show_modal.wav");
  const currentUi = Ui.get(activeGame.pid);
  overlayState.originalUi = {
    pid: activeGame.pid,
    prevLayout: currentUi.lists,
    prevCallback: currentUi.parentCallback || (() => {}),
    prevType: currentUi.type,
  };

  overlayState.container = new Html("div").appendTo("body").styleJs({
    backgroundColor: "rgba(0,0,0,0.6)",
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
    zIndex: "1000",
  });

  const panel = createPanel(overlayState.container, { width: "30%" });
  const ws = root.Security.getSecureVariable("CHERRY_TREE_WS");
  const friends = ws
    ? (await ws.sendMessage({ type: "get-friends" })).result
    : [];
  const uiType = "horizontal";
  let uiElements = [];

  const headingContents = new Html("div")
    .appendTo(panel)
    .styleJs({ display: "flex", flexDirection: "column", gap: "0.25rem" });
  new Html("h1")
    .text("Social Hub")
    .styleJs({
      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      marginBottom: "0.5rem",
    })
    .appendTo(headingContents);
  new Html("p")
    .html(
      activeGame.activeParty
        ? `In a party: <strong>${activeGame.activeParty.partyName}</strong>`
        : `Currently playing: <strong>${activeGame.gameName}</strong>`,
    )
    .styleJs({ color: "#adb5bd", margin: "0" })
    .appendTo(headingContents);

  new Html("div").appendTo(panel).styleJs({
    height: "1px",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    margin: "1rem 0",
  });

  let partyButtons = new Html("div").appendTo(panel).styleJs({
    width: "100%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: "10px",
  });

  let buttonStates = {
    inParty: () => {
      return new Promise((resolve, reject) => {
        new Html("button")
          .html(`${icons.mute} <span>Mute</span>`)
          .appendTo(partyButtons)
          .styleJs({
            minWidth: "3.25rem",
            height: "3.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.8rem",
            gap: "5px",
          });
        let settingsButton = new Html("button")
          .html(`${icons.settings} <span>Settings</span>`)
          .appendTo(partyButtons)
          .styleJs({
            minWidth: "3.25rem",
            height: "3.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.8rem",
            gap: "5px",
          })
          .on("click", () => {
            settingsButton.classOff("over");
            showSettingsPanel();
          });

        new Html("div").appendTo(panel).styleJs({
          height: "1px",
          width: "100%",
          backgroundColor: "rgba(255,255,255,0.1)",
          margin: "1rem 0",
        });

        new Html("h2").text("Your party").appendTo(panel).styleJs({
          paddingBottom: "0.5rem",
          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "1rem",
        });
        if (socket) {
          socket.emit("partyInfo", activeParty.hostCode, (data) => {
            console.log("Got party data", data);
            let partyData = data.party;
            if (partyData.participants.length > 0) {
              const participantListContainer = new Html("div")
                .class("flex-list")
                .styleJs({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                })
                .appendTo(panel);
              partyData.participants.forEach((participant) => {
                const row = new Html("button")
                  .appendTo(participantListContainer)
                  .styleJs({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    background: "rgba(0,0,0,0.2)",
                    transition: "all 0.2s ease",
                  })
                  .on("click", () => {
                    row.classOff("over");
                    showProfilePanel(participant);
                  })
                  .on(
                    "mouseenter",
                    (e) => (e.target.style.background = "rgba(0,0,0,0.4)"),
                  )
                  .on(
                    "mouseleave",
                    (e) => (e.target.style.background = "rgba(0,0,0,0.2)"),
                  );

                const nameContainer = new Html("div").appendTo(row).styleJs({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexGrow: "1",
                });

                new Html("span")
                  .text(participant.name)
                  .styleJs({ fontSize: "1rem", fontWeight: "500" })
                  .appendTo(nameContainer);

                new Html("div").appendTo(row).styleJs({
                  width: "0.6em",
                  height: "0.6em",
                  borderColor: "#adb5bd",
                  borderStyle: "solid",
                  borderWidth: "0.15em 0.15em 0 0",
                  transform: "rotate(45deg)",
                });

                uiElements.push([row.elm]);
              });
            } else {
              new Html("div")
                .text("Invite some people!")
                .appendTo(panel)
                .styleJs({
                  width: "100%",
                  textAlign: "center",
                  color: "#adb5bd",
                  padding: "1rem 0",
                  fontStyle: "italic",
                });
            }
            resolve();
          });
        }
      });
    },
    notInParty: () => {
      return new Promise((resolve, reject) => {
        new Html("button")
          .html(`${icons.plus} <span>Create</span>`)
          .appendTo(partyButtons)
          .styleJs({
            minWidth: "3.25rem",
            height: "3.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.8rem",
            gap: "5px",
          });
        let settingsButton = new Html("button")
          .html(`${icons.settings} <span>Settings</span>`)
          .appendTo(partyButtons)
          .styleJs({
            minWidth: "3.25rem",
            height: "3.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.8rem",
            gap: "5px",
          })
          .on("click", () => {
            settingsButton.classOff("over");
            showSettingsPanel();
          });

        resolve();
      });
    },
  };

  uiElements.push(partyButtons.elm.children);

  if (activeGame.activeParty) {
    await buttonStates.inParty();
  } else {
    await buttonStates.notInParty();
  }

  new Html("div").appendTo(panel).styleJs({
    height: "1px",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    margin: "1rem 0",
  });

  new Html("h2").text("Your friends").appendTo(panel).styleJs({
    paddingBottom: "0.5rem",
    textShadow: "0 1px 2px rgba(0,0,0,0.4)",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginBottom: "1rem",
  });

  if (friends.length > 0) {
    const friendListContainer = new Html("div")
      .class("flex-list")
      .styleJs({ display: "flex", flexDirection: "column", gap: "0.5rem" })
      .appendTo(panel);
    friends.forEach((friend) => {
      const row = new Html("button")
        .appendTo(friendListContainer)
        .styleJs({
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          background: "rgba(0,0,0,0.2)",
          transition: "all 0.2s ease",
        })
        .on("click", () => {
          row.classOff("over");
          showProfilePanel(friend);
        })
        .on(
          "mouseenter",
          (e) => (e.target.style.background = "rgba(0,0,0,0.4)"),
        )
        .on(
          "mouseleave",
          (e) => (e.target.style.background = "rgba(0,0,0,0.2)"),
        );

      const nameContainer = new Html("div").appendTo(row).styleJs({
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        flexGrow: "1",
      });

      new Html("div")
        .styleJs({
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: friend.status === 1 ? "#1be350" : "#6c757d",
          flexShrink: "0",
          border: "2px solid rgba(255,255,255,0.5)",
        })
        .appendTo(nameContainer);

      new Html("span")
        .text(friend.name)
        .styleJs({ fontSize: "1rem", fontWeight: "500" })
        .appendTo(nameContainer);

      new Html("div").appendTo(row).styleJs({
        width: "0.6em",
        height: "0.6em",
        borderColor: "#adb5bd",
        borderStyle: "solid",
        borderWidth: "0.15em 0.15em 0 0",
        transform: "rotate(45deg)",
      });

      uiElements.push([row.elm]);
    });
  } else {
    new Html("div")
      .text("You don't have any friends yet!")
      .appendTo(panel)
      .styleJs({
        width: "100%",
        textAlign: "center",
        color: "#adb5bd",
        padding: "2rem 0",
        fontStyle: "italic",
      });
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

const generateHostCode = (prefix = "terebiParty-") => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
  let code = prefix;
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
    subscribe(token) {
      socket = io(partyServer, {
        auth: { token },
      });
      socket.on("connect", () => {
        console.log("[PARTIES] Connected to socket!");
      });
      socket.on("parties", (data) => {
        partyList = data;
        console.log(partyList);
        document.dispatchEvent(
          new CustomEvent("CherryTree.Parties.List.Update"),
        );
      });
      socket.on("partyInvite", (data) => {
        if (activeParty) return;
        console.log(data);
        showSocialHubToast({
          icon: icons.users,
          title: "Party Invite",
          subtitle: `${data.host.name} has invited you to <strong>${data.info.partyName}</strong>!`,
          hint: "Go to the <strong>Friends</strong> menu to accept!",
        });
      });
    },
    getPartyList() {
      return partyList;
    },
    registerGame(gameData) {
      if (gameData.name && typeof gameData.name == "string") {
        activeGame.gameName = gameData.name;
      }
      if (!gameData.pid) {
        throw new Error("Process ID is required for overlay support!");
      }
      if (!gameData.packageName || typeof gameData.packageName !== "string") {
        throw new Error("packageName is required for party invites!");
      }
      activeGame.pid = gameData.pid;
      activeGame.registered = true;
      activeGame.packageName = gameData.packageName;
      document.addEventListener(
        "CherryTree.Parties.Overlay.Open",
        onOverlayOpen,
      );

      showSocialHubToast({
        icon: icons.users,
        title: "Social Hub Available",
        subtitle: `Invite friends and play <strong>${activeGame.gameName}</strong> together.`,
        hint: "Press the <strong>Social Hub</strong> button to open",
      });
    },
    unregisterGame() {
      if (activeParty) {
        endPartyInternal(activeParty.partyName, activeParty.hostCode);
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
          return;
        }

        if (activeParty) {
          reject(new Error("A party is already active!"));
          return;
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

          activeParty = {
            partyName,
            hostCode,
            peer: negotiatorPeer,
            peers: [],
            _ended: false,
          };

          activeGame.activeParty = {
            partyName,
            hostCode,
            endParty: () => endPartyInternal(partyName, hostCode),
          };

          if (socket) {
            socket.emit(
              "createParty",
              { partyName, hostCode },
              async (data) => {
                activeRoom = new LivekitClient.Room();
                await activeRoom.connect(livekitServer, data.livekitToken);
                console.log("connected to room", activeRoom.name);
              },
            );
          }

          console.log("[PARTIES] Party created successfully:", {
            partyName,
            hostCode,
          });

          showSocialHubToast({
            icon: icons.users,
            title: "Party created",
            subtitle: `<strong>${partyName}</strong> has been created!`,
            hint: "Open the <strong>Social Hub</strong> to invite friends",
          });

          resolve({
            partyName,
            hostCode,
            endParty: () => endPartyInternal(partyName, hostCode),
          });
        });

        negotiatorPeer.on("error", (err) => {
          console.error("[PARTIES] PeerJS connection error:", err);
          reject(err);
        });

        negotiatorPeer.on("connection", (conn) => {
          console.log(`[PARTIES] Incoming connection from ${conn.peer}`);
          conn.on("data", (joinData) => {
            console.log("join data", joinData);
            if (!socket) {
              conn.close();
            }

            socket.emit(
              "verifyInviteToken",
              { token: joinData.token },
              (result) => {
                console.log(result);
                if (!result.valid) {
                  conn.close();
                }
                if (result.decoded.userId != joinData.info.id) {
                  conn.close();
                }
                let peerCode = generateHostCode(joinData.info.name);
                let userPeer = new Peer(peerCode, {
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
                userPeer.on("open", () => {
                  conn.send({ success: true, connectTo: peerCode });
                });
                userPeer.on("connection", (userConn) => {
                  if (activeParty && Array.isArray(activeParty.peers)) {
                    activeParty.peers.push({
                      peer: userPeer,
                      peerCode,
                      userInfo: joinData.info,
                      connection: userConn,
                    });
                    showSocialHubToast({
                      icon: icons.users,
                      title: "Joined Party!",
                      subtitle: `${joinData.info.name} joined your party.`,
                      hint: "Chat with them by opening the <strong>Social Hub</strong>!",
                    });
                    document.dispatchEvent(
                      new CustomEvent("CherryTree.Party.PeerConnected", {
                        detail: {
                          peerCode,
                          userInfo: joinData.info,
                          connection: userConn,
                        },
                      }),
                    );
                    userConn.on("data", (msg) => {
                      document.dispatchEvent(
                        new CustomEvent("CherryTree.Party.PeerMessage", {
                          detail: {
                            peerCode,
                            userInfo: joinData.info,
                            message: msg,
                          },
                        }),
                      );
                    });
                  }
                });
              },
            );
          });
        });
      });
    },
    endParty(hostCode) {
      if (activeParty && activeParty.hostCode === hostCode) {
        endPartyInternal(activeParty.partyName, hostCode);
      }
    },
    getPartyInfo(hostCode) {
      if (activeParty && activeParty.hostCode === hostCode) {
        return {
          partyName: activeParty.partyName,
          hostCode: activeParty.hostCode,
        };
      }
      return undefined;
    },

    getParty(hostCode) {
      if (activeParty && activeParty.hostCode === hostCode) {
        return activeParty;
      }
      return undefined;
    },
    joinParty(invite) {
      return new Promise((resolve, reject) => {
        if (
          !invite ||
          !invite.info ||
          !invite.info.hostCode ||
          !invite.inviteToken ||
          !invite.livekitToken
        ) {
          reject(new Error("Invalid invite object"));
          return;
        }
        const peer = new Peer(undefined, {
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

        let userPeerConn = null;

        peer.on("open", async () => {
          let info = await Users.getUserInfo(await root.Security.getToken());
          const conn = peer.connect(invite.info.hostCode);
          conn.on("open", () => {
            conn.send({ token: invite.inviteToken, info });
            showSocialHubToast({
              icon: icons.users,
              title: "Verifying...",
              subtitle: `We're getting you to join <strong>${invite.info.partyName}</strong>...`,
              hint: "Wait for the verification to finish.",
            });
          });
          conn.on("data", (data) => {
            if (data.success && data.connectTo) {
              userPeerConn = peer.connect(data.connectTo);
              userPeerConn.on("open", async () => {
                showSocialHubToast({
                  icon: icons.users,
                  title: "Joined Party!",
                  subtitle: `You have joined <strong>${invite.info.partyName}</strong>.`,
                  hint: "",
                });

                Sfx.playSfx("deck_ui_launch_game.wav");

                if (socket) {
                  socket.emit("participantJoin", invite.info.hostCode);
                }

                activeParty = {
                  partyName: invite.info.partyName,
                  hostCode: invite.info.hostCode,
                  peer: peer,
                  peers: [],
                  _ended: false,
                  connection: userPeerConn,
                };

                activeGame.activeParty = {
                  partyName: invite.info.partyName,
                  hostCode: invite.info.hostCode,
                  endParty: () =>
                    endPartyInternal(
                      invite.info.partyName,
                      invite.info.hostCode,
                      true,
                    ),
                };

                activeRoom = new LivekitClient.Room();
                await activeRoom.connect(livekitServer, invite.livekitToken);
                console.log("connected to room", activeRoom.name);

                resolve({
                  send: (msg) => {
                    if (userPeerConn && userPeerConn.open) {
                      userPeerConn.send(msg);
                    }
                  },
                  close: () => {
                    if (userPeerConn) userPeerConn.close();
                    if (peer) peer.destroy();
                    endPartyInternal(
                      invite.info.partyName,
                      invite.info.hostCode,
                      true,
                    );
                  },
                  connection: userPeerConn,
                  peer,
                });
              });
              userPeerConn.on("data", (data) => {
                console.log("[PARTIES] Data received", data);
              });
              userPeerConn.on("error", (err) => {
                peer.destroy();
                reject(err);
              });
            }
          });
          conn.on("error", (err) => {
            peer.destroy();
            reject(err);
          });
        });

        peer.on("error", (err) => {
          reject(err);
        });
      });
    },
    getPeers() {
      if (activeParty && Array.isArray(activeParty.peers)) {
        return activeParty.peers;
      }
      return [];
    },
    broadcast(data) {
      if (activeParty && Array.isArray(activeParty.peers)) {
        activeParty.peers.forEach(({ connection }) => {
          if (connection && connection.open) {
            connection.send(data);
          }
        });
      }
    },
  },

  end: async function () {
    console.log("[PARTIES] Shutting down party connection.");
    if (activeParty) {
      endPartyInternal(activeParty.partyName, activeParty.hostCode);
    }
    console.log("[PARTIES] Shutdown complete.");
  },
};

export default pkg;

function endPartyInternal(partyName, hostCode, participant = false) {
  if (activeParty && !activeParty._ended) {
    activeParty._ended = true;
    if (activeParty.peer && !activeParty.peer.destroyed) {
      activeParty.peer.destroy();
    }
    if (activeRoom) {
      activeRoom.disconnect();
    }
    if (socket) {
      if (!participant) {
        socket.emit("endParty", hostCode);
      } else {
        socket.emit("participantLeave", hostCode);
      }
    }
    showSocialHubToast({
      icon: icons.users,
      title: participant ? "You left the party" : "Party ended",
      subtitle: participant
        ? `You left <strong>${partyName}</strong>`
        : `<strong>${partyName}</strong> has ended.`,
      hint: "",
    });
    console.log(`[PARTIES] Ended party: ${hostCode}`);
    activeParty = null;
    activeGame.activeParty = null;
  }
}
