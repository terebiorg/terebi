import icons from "../../libs/icons.js";
import Html from "/libs/html.js";
import {
  CaptionsRenderer,
  parseResponse,
  parseText,
} from "/libs/media-captions/dist/prod.js";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps";

console.log(CaptionsRenderer);

let wrapper, Ui, Users, Pid, Sfx, volumeUpdate;
let friends = [];
let pingInterval = null;
let lastPingTime = 0;
const PING_INTERVAL = 5000; // Send ping every 5 seconds
const PING_TIMEOUT = 15000; // Consider disconnected after 15 seconds of no response

let brightness = localStorage.getItem("videoBrightness")
  ? parseInt(localStorage.getItem("videoBrightness"))
  : 100;
let contrast = localStorage.getItem("videoContrast")
  ? parseInt(localStorage.getItem("videoContrast"))
  : 100;
let saturation = localStorage.getItem("videoSaturation")
  ? parseInt(localStorage.getItem("videoSaturation"))
  : 100;

const pkg = {
  name: "Video Player",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;
    Users = Root.Processes.getService("UserSvc").data;
    wrapper = new Html("div").class("full-ui").appendTo("body");

    Ui.becomeTopUi(Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;

    Sfx.playSfx("deck_ui_into_game_detail.wav");

    const Background = Root.Processes.getService("Background").data;
    let ws = Root.Security.getSecureVariable("CHERRY_TREE_WS");

    console.log(Sfx);

    const audio = Sfx.getAudio();

    function stopBgm() {
      audio.pause();
    }
    async function playBgm() {
      let playBgm = await window.localforage.getItem("settings__playBgm");
      if (playBgm) {
        audio.play();
      }
    }

    async function GetFolder(path) {
      const url = `http://localhost:9864/list`;
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dir: path }),
      };
      return new Promise((resolve, reject) => {
        fetch(url, options)
          .then((res) => res.json())
          .then((json) => resolve(json))
          .catch((err) => reject("error:" + err));
      });
    }

    async function findCaptions(path) {
      let rootFolder = path.substring(0, path.lastIndexOf("/") + 1);
      if (rootFolder.trim() == "") {
        rootFolder = path.substring(0, path.lastIndexOf("\\") + 1);
      }
      let fileName = path.split(/.*[\/|\\]/)[1];
      let noExt = fileName.replace(/\.[^/.]+$/, "");
      console.log(rootFolder);
      console.log(noExt);
      let folder = await GetFolder(rootFolder);
      let foundCaptions = [];
      folder.forEach((item) => {
        if (item.type == "file") {
          let re = /(?:\.([^.]+))?$/;
          let ext = re.exec(item.name)[1];
          console.log(ext);
          console.log(item.name);
          if (ext == "vtt" && item.name.startsWith(noExt)) {
            console.log(`[Captions] Found caption ${item.name}`);
            foundCaptions.push(rootFolder + item.name);
          }
        }
      });
      console.log(foundCaptions.length);
      if (foundCaptions.length > 0) {
        return foundCaptions;
      } else {
        return null;
      }
    }

    let videoElm;
    let invButton;
    let top;
    let bottom;
    let playPause;
    let progress, progressBarValue;
    let timeElapsed, timeElapsedFront, timeElapsedMiddle, timeElapsedBack;
    let captionToggle;
    let vidInfo;
    let captionOverlay;
    let renderer;
    let trackFetchAbort;

    // let call = null;
    let peer = null;

    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";

    let stream;

    async function hostWatchParty(videoElm, captions) {
      let hostCode = "watchParty-";
      for (let i = 0; i < 10; i++) {
        hostCode += chars[Math.floor(Math.random() * chars.length)];
      }
      return new Promise((resolve, reject) => {
        let peer = new Peer(hostCode, {
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
        function closePeer() {
          peer.destroy();
          document.removeEventListener(
            "CherryTree.VideoPlayer.Close",
            closePeer,
          );
        }
        document.addEventListener("CherryTree.VideoPlayer.Close", closePeer);
        peer.on("open", () => {
          resolve(hostCode);
        });
        peer.on("error", (e) => {
          reject(e);
        });
        peer.on("connection", (conn) => {
          console.log(conn);
          // Start ping interval for this connection
          pingInterval = setInterval(() => {
            conn.send({ type: "ping", timestamp: Date.now() });
          }, PING_INTERVAL);
          videoElm.addEventListener("timeupdate", () => {
            conn.send({
              type: "timeupdate",
              currentTime: videoElm.currentTime,
              duration: videoElm.duration,
            });
          });
          videoElm.addEventListener("pause", () => {
            conn.send({ type: "pause" });
          });
          videoElm.addEventListener("play", () => {
            conn.send({ type: "play" });
          });
          conn.on("data", async (data) => {
            console.log(data);
            if (data.type == "connect") {
              if (!data.username) {
                conn.send({
                  type: "error",
                  message: "Please identify yourself",
                });
                conn.close();
              } else {
                Root.Libs.Notify.show(
                  `${data.username} has joined the party 🎉`,
                  `They're now watching with you.`,
                );
                console.log(stream);
                let call = peer.call(conn.peer, stream);

                call.on("close", () => {
                  console.log("User disconnected, destroying peer object");
                  conn.close();
                });
                call.on("disconnect", () => {
                  console.log("User disconnected, destroying peer object");
                  conn.close();
                });
              }
            }
            if (data.type == "getCaptions") {
              conn.send({ type: "captions", captions: captions });
            }
            if (data.type == "loadCaption") {
              let caption = captions[data.index];
              let urlObj = new URL("http://127.0.0.1:9864/getFile");
              urlObj.searchParams.append("path", caption);
              let fileName = caption.split(/.*[\/|\\]/)[1];
              let noExt = fileName.replace(/\.[^/.]+$/, "");
              let re = /(?:\.([^.]+))?$/;
              let lang = re.exec(noExt)[1]
                ? re.exec(noExt)[1]
                : "No language specified";
              let captionData = await getTrack(urlObj.href);
              conn.send({
                type: "captionData",
                captionName: lang,
                captionData: captionData,
              });
            }
            if (data.type === "pong") {
              lastPingTime = Date.now();
              return;
            }
          });
          conn.on("close", () => {
            Root.Libs.Notify.show(
              "User left",
              `This user has left the watch party.`,
            );
            // Clear ping interval on connection close
            if (pingInterval) {
              clearInterval(pingInterval);
              pingInterval = null;
            }
            // peer.destroy();
          });
        });
      });
    }

    function formatTime(timeInSeconds) {
      const result = new Date(timeInSeconds * 1000).toISOString().slice(11, 19);

      return {
        minutes: result.slice(3, 5),
        seconds: result.slice(6, 8),
      };
    }

    function createVideoElement(path, isLocal, isWatchParty = false) {
      let url = path;
      let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      if (isLocal) {
        let urlObj = new URL("http://127.0.0.1:9864/getFile");
        urlObj.searchParams.append("path", path);
        url = urlObj.href;
      }
      let attr = { src: url, crossorigin: "anonymous" };
      if (isWatchParty) {
        attr = { crossorigin: "anonymous" };
      }
      videoElm = new Html("video")
        .appendTo(wrapper)
        .styleJs({
          width: "100%",
          height: "100%",
          position: "absolute",
          filter: filterStr,
        })
        .attr(attr);

      videoElm.elm.controls = false;
      return videoElm;
    }

    function createTopBar() {
      top = new Html("div").class("flex-list").appendTo(wrapper).styleJs({
        position: "absolute",
        width: "100%",
        position: "absolute",
        top: 0,
        zIndex: "100",
      });
      invButton = new Html("button")
        .text("You should not see this!")
        .appendTo(top)
        .styleJs({
          opacity: 0,
        });
      return top;
    }

    function createBottomBar() {
      bottom = new Html("div").class("flex-list").appendTo(wrapper).styleJs({
        position: "absolute",
        bottom: "1rem",
        zIndex: "100",
        width: "calc(100% - 2rem)",
        opacity: "1",
        left: "1rem",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        transition: "0.1s linear",
        padding: "1rem",
        borderRadius: "8px",
        opacity: "0",
      });
      return bottom;
    }

    function createCaptionOverlay() {
      captionOverlay = new Html("div")
        .styleJs({
          bottom: "48px",
          transition: "all 0.1s cubic-bezier(0.87, 0, 0.13, 1)",
        })
        .appendTo(wrapper);
      renderer = new CaptionsRenderer(captionOverlay.elm);
      return captionOverlay;
    }

    function createVideoInfo(displayName, path) {
      vidInfo = new Html("div").class("flex-column").appendTo(wrapper).styleJs({
        position: "absolute",
        top: "0",
        zIndex: "99",
        opacity: 0,
        height: "100%",
        width: "100%",
        background: "linear-gradient(to top, #0000, #000f)",
        transition: "all 0.1s linear",
      });
      let noExt = "undefined";
      if (path) {
        let fileName = path.split(/.*[\/|\\]/)[1];
        noExt = fileName.replace(/\.[^/.]+$/, "");
      }
      new Html("h1")
        .text(displayName ? displayName : noExt)
        .appendTo(vidInfo)
        .styleJs({
          padding: "3.25rem",
        });

      window.desktopIntegration !== undefined &&
        window.desktopIntegration.ipc.send("setRPC", {
          details: "Now watching",
          state: displayName ? displayName : noExt,
          button1: {
            label: "Watch along",
            url: "https://localhost:9864",
          },
        });

      return vidInfo;
    }

    function createControlButtons(bottom) {
      new Html("button")
        .html(icons["stepBack"])
        .appendTo(bottom)
        .on("click", () => {
          console.log("click");
          let currentVideoTime = videoElm.elm.currentTime
            ? videoElm.elm.currentTime
            : 0;
          let newTime = currentVideoTime - 10;
          if (newTime < 0) {
            newTime = 0;
          }
          videoElm.elm.currentTime = newTime;
        })
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        });

      playPause = new Html("button")
        .html(icons["play"])
        .appendTo(bottom)
        .on("click", () => {
          console.log("click");
          let paused = videoElm.elm.paused || videoElm.elm.ended;
          console.log(paused);
          if (paused) {
            videoElm.elm.play();
          } else {
            videoElm.elm.pause();
          }
        })
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        });

      new Html("button")
        .html(icons["stepForward"])
        .appendTo(bottom)
        .on("click", () => {
          console.log("click");
          let currentVideoTime = videoElm.elm.currentTime
            ? videoElm.elm.currentTime
            : 0;
          let newTime = currentVideoTime + 10;
          if (newTime > videoElm.elm.duration) {
            newTime = videoElm.elm.duration;
          }
          videoElm.elm.currentTime = newTime;
        })
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        });
      return playPause;
    }

    function createTimeElapsed(bottom) {
      timeElapsed = new Html("p").appendTo(bottom).styleJs({
        flexShrink: "0",
        display: "flex",
        "align-items": "center",
        gap: "8px",
      });
      timeElapsedFront = new Html("span").styleJs({ fontSize: "1.3rem" });
      timeElapsedMiddle = new Html("span")
        .styleJs({ opacity: 0.7, fontSize: "1.8rem" })
        .text("/");
      timeElapsedBack = new Html("span").styleJs({ fontSize: "1.3rem" });
      timeElapsed.appendMany(
        timeElapsedFront,
        timeElapsedMiddle,
        timeElapsedBack,
      );
      return timeElapsed;
    }

    function createProgressSlider(bottom) {
      progress = new Html("div")
        .class("vp-progress-bar")
        .style({
          "flex-grow": "1",
        })
        .appendTo(bottom);
      progressBarValue = new Html("div")
        .class("vp-progress-bar-value")
        .appendTo(progress);
      return progress;
    }

    function updateProgressValue(val) {
      progressBarValue.style({ width: `${val}%` });
    }

    function createCaptionToggleButton(bottom, captions, displayName, path) {
      captionToggle = new Html("button")
        .html(captions ? icons["captionsOn"] : icons["captionsOff"])
        .appendTo(bottom)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        });

      if (captions != null) {
        let urlObj = new URL("http://127.0.0.1:9864/getFile");
        urlObj.searchParams.append("path", captions[0]);
        loadNewTrack(urlObj.href);
        captionToggle.on("click", (e) => {
          openCaptionsMenu(e, captions, displayName, path);
        });
      } else {
        captionToggle.on("click", () => {
          Root.Libs.Notify.show(
            `This video doesn't have captions`,
            `To show captions, please put subtitle files (.vtt) in the video's directory.`,
          );
        });
      }
      return captionToggle;
    }

    function createPartyCaptionToggleButton(bottom, callback) {
      captionToggle = new Html("button")
        .html(icons["captionsOn"])
        .appendTo(bottom)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        });
      captionToggle.on("click", (e) => {
        callback();
      });
      return captionToggle;
    }

    function createBroadcastButton(bottom, displayName, noExt) {
      new Html("button")
        .html(icons["broadcast"])
        .appendTo(bottom)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        })
        .on("click", async (e) => {
          if (ws) {
            friends = (await ws.sendMessage({ type: "get-friends" })).result;
            console.log(friends);
            openWatchPartyMenu(e, displayName, noExt);
          }
        });
    }

    function createPictureAdjustButton(bottom) {
      new Html("button")
        .html(icons["slider"])
        .appendTo(bottom)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.8rem",
        })
        .on("click", (e) => {
          openPictureAdjustMenu(e);
        });
    }

    function addVideoEventListeners() {
      videoElm.on("loadedmetadata", () => {
        const videoDuration = Math.round(videoElm.elm.duration);
        const time = formatTime(videoDuration);
        timeElapsedFront.text("00:00");
        timeElapsedBack.text(`${time.minutes}:${time.seconds}`);
        updateProgressValue(0);
      });
      videoElm.on("timeupdate", () => {
        const videoDuration = Math.round(videoElm.elm.duration);
        const duration = formatTime(videoDuration);
        const videoElapsed = Math.round(videoElm.elm.currentTime);
        const elapsed = formatTime(videoElapsed);
        timeElapsedFront.text(`${elapsed.minutes}:${elapsed.seconds}`);
        timeElapsedBack.text(`${duration.minutes}:${duration.seconds}`);
        updateProgressValue(
          (videoElm.elm.currentTime / videoElm.elm.duration) * 100,
        );
        renderer.currentTime = videoElm.elm.currentTime;
      });
      videoElm.elm.volume = Sfx.getVolume();
      volumeUpdate = (e) => {
        videoElm.elm.volume = e.detail / 100;
      };
      document.addEventListener("CherryTree.Ui.VolumeChange", volumeUpdate);
      videoElm.on("play", () => {
        playPause.html(icons["pause"]);
        Sfx.playSfx("deck_ui_switch_toggle_on.wav");
        stopBgm();
      });
      videoElm.on("pause", () => {
        playPause.html(icons["play"]);
        Sfx.playSfx("deck_ui_switch_toggle_off.wav");
        playBgm();
      });
    }

    function addPartyEventListeners(conn, partyName) {
      // Start checking for ping timeouts
      let pingCheckInterval = setInterval(() => {
        if (Date.now() - lastPingTime > PING_TIMEOUT) {
          Root.Libs.Notify.show(
            "Connection lost",
            "Lost connection to the host. The watch party will end.",
          );
          clearInterval(pingCheckInterval);
          pkg.end();
        }
      }, PING_INTERVAL);

      conn.on("data", async (data) => {
        if (data.type == "timeupdate") {
          const videoDuration = Math.round(data.duration);
          const duration = formatTime(videoDuration);
          const videoElapsed = Math.round(data.currentTime);
          const elapsed = formatTime(videoElapsed);
          timeElapsedFront.text(`${elapsed.minutes}:${elapsed.seconds}`);
          timeElapsedBack.text(`${duration.minutes}:${duration.seconds}`);
          updateProgressValue((data.currentTime / data.duration) * 100);
          renderer.currentTime = data.currentTime;
        }
        if (data.type == "play") {
          Sfx.playSfx("deck_ui_switch_toggle_on.wav");
          stopBgm();
        }
        if (data.type == "pause") {
          Sfx.playSfx("deck_ui_switch_toggle_off.wav");
          playBgm();
        }
        if (data.type == "captionData") {
          console.log(data.captionData);
          console.log(renderer);
          const { regions, cues } = await parseText(data.captionData);
          console.log(regions, cues);
          renderer.changeTrack({ regions, cues });
          Root.Libs.Notify.show(
            "Captions toggled",
            `Now using caption ${data.captionName}`,
          );
        }
        if (data.type == "captions") {
          console.log(data.captions);
          openPartyCaptionsMenu(data.captions, conn, partyName);
        }
        if (data.type === "ping") {
          // Respond to ping with pong
          conn.send({ type: "pong", timestamp: data.timestamp });
          lastPingTime = Date.now();
          return;
        }
      });
      conn.on("close", () => {
        if (pingCheckInterval) {
          clearInterval(pingCheckInterval);
        }
        Root.Libs.Notify.show(
          "Watch party ended",
          `This watch party has ended.`,
        );
        pkg.end();
      });
      videoElm.elm.volume = Sfx.getVolume();
      volumeUpdate = (e) => {
        videoElm.elm.volume = e.detail / 100;
      };
      document.addEventListener("CherryTree.Ui.VolumeChange", volumeUpdate);
    }

    function playVideo(
      path,
      captions = null,
      displayName = null,
      isLocal = true,
      autoplay = true,
    ) {
      let fileName = path.split(/.*[\/|\\]/)[1];
      let noExt = fileName.replace(/\.[^/.]+$/, "");

      createVideoElement(path, isLocal);
      createTopBar();
      let bottom = createBottomBar();
      createCaptionOverlay();
      createVideoInfo(displayName, path);

      createControlButtons(bottom);
      createTimeElapsed(bottom);
      createProgressSlider(bottom);
      createCaptionToggleButton(bottom, captions, displayName, path);
      createBroadcastButton(bottom, displayName, noExt);
      createPictureAdjustButton(bottom);
      addVideoEventListeners();

      Ui.transition("popIn", wrapper);
      stream = videoElm.elm.mozCaptureStream
        ? videoElm.elm.mozCaptureStream()
        : videoElm.elm.captureStream();
      if (autoplay) {
        playPause.html(icons["pause"]);
        videoElm.elm.play();
      }

      Ui.init(
        Pid,
        "horizontal",
        [top.elm.children, bottom.elm.children],
        handleUiNavigation,
      );
    }

    async function connectToParty(watchCode, partyName) {
      createVideoElement("", false, true);
      createTopBar();
      let bottom = createBottomBar();
      createCaptionOverlay();
      createVideoInfo(partyName, null);
      createTimeElapsed(bottom);
      createProgressSlider(bottom);
      let closeModalCb = null;
      await Root.Libs.Modal.showWithoutButtons(
        "Loading",
        "Joining Watch Party...",
        wrapper,
        Root.Pid,
        function (a) {
          closeModalCb = a;
        },
      );
      peer = new Peer(undefined, {
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
      function closePeer() {
        peer.destroy();
        document.removeEventListener("CherryTree.VideoPlayer.Close", closePeer);
      }
      document.addEventListener("CherryTree.VideoPlayer.Close", closePeer);
      peer.on("open", async () => {
        let info = await Users.getUserInfo(await Root.Security.getToken());
        let conn = peer.connect(watchCode);
        conn.on("open", () => {
          conn.send({ type: "connect", username: info.name });
          // conn.on("data", (data) => {
          //   console.log(data);
          // });
          createPartyCaptionToggleButton(bottom, function () {
            conn.send({ type: "getCaptions" });
          });
          createPictureAdjustButton(bottom);
          addPartyEventListeners(conn, partyName);
          Ui.transition("popIn", wrapper);
          Ui.init(
            Pid,
            "horizontal",
            [top.elm.children, bottom.elm.children],
            handleUiNavigation,
          );
          peer.on("call", (call) => {
            call.answer();
            call.on("stream", (stream) => {
              closeModalCb();
              videoElm.elm.srcObject = stream;
              videoElm.elm.play();
            });
          });
        });
      });
    }

    async function getTrack(captionPath) {
      return new Promise((resolve, reject) => {
        try {
          trackFetchAbort?.abort();
          const signal = (trackFetchAbort = new AbortController()).signal;
          fetch(captionPath, { signal })
            .then((res) => res.text())
            .then((text) => resolve(text));
        } catch (e) {
          reject(e);
        }
      });
    }

    async function loadNewTrack(captionPath) {
      try {
        trackFetchAbort?.abort();
        const signal = (trackFetchAbort = new AbortController()).signal;
        const { regions, cues } = await parseResponse(
          fetch(captionPath, { signal }),
        );
        renderer.changeTrack({ regions, cues });
      } catch (e) {
        console.log(`Aborted loading subtitle track!`, e);
      }
    }

    function openMenu(overlay, tempUiElems, onNavigate) {
      Sfx.playSfx("deck_ui_into_game_detail.wav");
      Ui.transition("popIn", overlay);
      bottom.styleJs({ opacity: "0" });
      vidInfo.styleJs({ opacity: "0" });
      captionOverlay.styleJs({ bottom: "48px" });

      Ui.init(Pid, "horizontal", tempUiElems, function (e) {
        if (e === "back") {
          closeMenu(overlay);
        }
        if (onNavigate) onNavigate();
      });
    }

    function closeMenu(overlay) {
      Sfx.playSfx("deck_ui_out_of_game_detail.wav");
      Ui.transition("popOut", overlay);
      setTimeout(() => {
        overlay.cleanup();
        bottom.styleJs({ opacity: "1" });
        vidInfo.styleJs({ opacity: "1" });
        captionOverlay.styleJs({
          bottom: "calc(48px + 3rem)",
        });
        Ui.init(
          Pid,
          "horizontal",
          [top.elm.children, bottom.elm.children],
          handleUiNavigation,
        );
      }, 200);
    }

    function openWatchPartyMenu(e, displayName, noExt) {
      let overlay = new Html("div")
        .styleJs({
          width: "25rem",
          height: "600px",
          background: "rgba(0,0,0,0.5)",
          position: "absolute",
          top: "3.25rem",
          left: "3.25rem",
          zIndex: 1000000,
          backdropFilter: "blur(50px)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          padding: "25px",
          overflow: "scroll",
          scrollBehavior: "smooth",
          gap: "10px",
        })
        .appendTo(wrapper);
      new Html("h1").text("Invite a friend").appendTo(overlay);
      new Html("p")
        .html(
          `Get a friend to watch <strong>${
            displayName ? displayName : noExt
          }</strong> with you`,
        )
        .appendTo(overlay);
      new Html("br").appendTo(overlay);
      new Html("h2")
        .text("Who's online")
        .appendTo(overlay)
        .styleJs({ paddingBottom: "10px" });
      let tempUiElems = [];
      let hasFriend = false;
      friends.forEach((friend) => {
        if (friend.status == 1) {
          console.log(friend);
          hasFriend = true;
          let row = new Html("div")
            .class("flex-list")
            .appendTo(overlay)
            .styleJs({ width: "100%" });
          new Html("button")
            .text(friend.name)
            .appendTo(row)
            .styleJs({ width: "100%" })
            .on("click", async () => {
              let friendId = friend.id;
              console.log(friend.id);
              let hostCode = await hostWatchParty(videoElm.elm, captions);
              let result = await ws.sendMessage({
                type: "watchParty",
                userId: friendId,
                message: JSON.stringify({
                  name: displayName ? displayName : noExt,
                  partyId: hostCode,
                }),
              });
              console.log(result);
              if (result.type == "success") {
                Root.Libs.Notify.show(
                  "Successfully invited",
                  `${friend.name} has been invited to your watch party.`,
                );
              }
            });
          tempUiElems.push(row.elm.children);
        }
      });
      if (!hasFriend) {
        let row = new Html("div")
          .class("flex-list")
          .appendTo(overlay)
          .styleJs({ width: "100%" });
        new Html("button")
          .text("None of your friends are online")
          .appendTo(row)
          .styleJs({ width: "100%" });
        tempUiElems.push(row.elm.children);
      }

      openMenu(overlay, tempUiElems, () => {
        // Add scroll adjustment when navigating
        setTimeout(() => {
          let scrolled = false;
          for (const div of overlay.qsa(".flex-list")) {
            let button = div.elm.children[0];
            let focused = button.classList.contains("over");
            if (focused) {
              overlay.elm.scrollTop =
                div.elm.offsetTop +
                window.scrollY -
                overlay.elm.offsetHeight / 2 +
                50;
              scrolled = true;
            }
          }
          if (!scrolled) {
            overlay.elm.scrollTop = 0;
          }
        }, 50);
      });
      e.target.classList.remove("over");
    }

    function openPictureAdjustMenu(e) {
      let overlay = new Html("div")
        .styleJs({
          width: "25rem",
          height: "600px",
          background: "rgba(0,0,0,0.5)",
          position: "absolute",
          top: "3.25rem",
          left: "3.25rem",
          zIndex: 1000000,
          backdropFilter: "blur(50px)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          padding: "25px",
          overflow: "scroll",
          gap: "10px",
        })
        .appendTo(wrapper);
      new Html("h1").text("Picture Adjustment").appendTo(overlay);
      new Html("p")
        .html(`Adjust picture settings to your liking.`)
        .appendTo(overlay);
      function previewChanges() {
        brightness = localStorage.getItem("videoBrightness")
          ? parseInt(localStorage.getItem("videoBrightness"))
          : 100;
        contrast = localStorage.getItem("videoContrast")
          ? parseInt(localStorage.getItem("videoContrast"))
          : 100;
        let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        videoElm.styleJs({ filter: filterStr });
      }
      function changeBrightness(plus, text) {
        if (plus) {
          brightness = brightness + 1;
        } else {
          brightness = brightness - 1;
        }
        localStorage.setItem("videoBrightness", brightness.toString());
        text.text(`${brightness}%`);
        previewChanges();
      }
      function changeContrast(plus, text) {
        if (plus) {
          contrast = contrast + 1;
        } else {
          contrast = contrast - 1;
        }
        localStorage.setItem("videoContrast", contrast.toString());
        text.text(`${contrast}%`);
        previewChanges();
      }
      function changeSaturation(plus, text) {
        if (plus) {
          saturation = saturation + 1;
        } else {
          saturation = saturation - 1;
        }
        localStorage.setItem("videoSaturation", saturation.toString());
        text.text(`${saturation}%`);
        previewChanges();
      }
      new Html("br").appendTo(overlay);
      new Html("h2").text("Brightness").appendTo(overlay);
      let brightnessInd;
      let tempUiElems = [];
      let row = new Html("div")
        .class("flex-list")
        .appendTo(overlay)
        .styleJs({ width: "100%" });
      new Html("button")
        .html(icons["minus"])
        .appendTo(row)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeBrightness(false, brightnessInd);
        });
      brightnessInd = new Html("p")
        .text(`${brightness}%`)
        .appendTo(row)
        .styleJs({
          width: "calc(100% - 100px)",
          textAlign: "center",
        });
      new Html("button")
        .html(icons["plus"])
        .appendTo(row)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeBrightness(true, brightnessInd);
        });
      new Html("br").appendTo(overlay);
      new Html("h2").text("Contrast").appendTo(overlay);
      let contrastInd;
      let row2 = new Html("div")
        .class("flex-list")
        .appendTo(overlay)
        .styleJs({ width: "100%" });
      new Html("button")
        .html(icons["minus"])
        .appendTo(row2)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeContrast(false, contrastInd);
        });
      contrastInd = new Html("p").text(`${contrast}%`).appendTo(row2).styleJs({
        width: "calc(100% - 100px)",
        textAlign: "center",
      });
      new Html("button")
        .html(icons["plus"])
        .appendTo(row2)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeContrast(true, contrastInd);
        });
      new Html("br").appendTo(overlay);
      new Html("h2").text("Saturation").appendTo(overlay);
      let saturationInd;
      let row3 = new Html("div")
        .class("flex-list")
        .appendTo(overlay)
        .styleJs({ width: "100%" });
      new Html("button")
        .html(icons["minus"])
        .appendTo(row3)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeSaturation(false, saturationInd);
        });
      saturationInd = new Html("p")
        .text(`${saturation}%`)
        .appendTo(row3)
        .styleJs({
          width: "calc(100% - 100px)",
          textAlign: "center",
        });
      new Html("button")
        .html(icons["plus"])
        .appendTo(row3)
        .styleJs({
          minWidth: "3.25rem",
          height: "3.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyItems: "center",
        })
        .on("click", () => {
          changeSaturation(true, saturationInd);
        });
      tempUiElems.push(row.elm.children);
      tempUiElems.push(row2.elm.children);
      tempUiElems.push(row3.elm.children);
      openMenu(overlay, tempUiElems);
      e.target.classList.remove("over");
    }

    function openCaptionsMenu(e, captions, displayName, path) {
      let overlay = new Html("div")
        .styleJs({
          width: "25rem",
          height: "600px",
          background: "rgba(0,0,0,0.5)",
          position: "absolute",
          top: "3.25rem",
          left: "3.25rem",
          zIndex: 1000000,
          backdropFilter: "blur(50px)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          padding: "25px",
          overflow: "scroll",
          scrollBehavior: "smooth",
          gap: "10px",
        })
        .appendTo(wrapper);
      new Html("h1").text("Captions").appendTo(overlay);
      new Html("p")
        .html(
          `Enable captions for <strong>${
            displayName
              ? displayName
              : path.split(/.*[\/|\\]/)[1].replace(/\.[^/.]+$/, "")
          }</strong>`,
        )
        .appendTo(overlay);
      new Html("br").appendTo(overlay);
      let tempUiElems = [];
      captions.forEach((caption) => {
        let fileName = caption.split(/.*[\/|\\]/)[1];
        let noExt = fileName.replace(/\.[^/.]+$/, "");
        let re = /(?:\.([^.]+))?$/;
        let lang = re.exec(noExt)[1]
          ? re.exec(noExt)[1]
          : "No language specified";
        console.log(caption);
        let row = new Html("div")
          .class("flex-list")
          .appendTo(overlay)
          .styleJs({ width: "100%" });
        new Html("button")
          .text(lang)
          .appendTo(row)
          .styleJs({ width: "100%" })
          .on("click", () => {
            let urlObj = new URL("http://127.0.0.1:9864/getFile");
            urlObj.searchParams.append("path", caption);
            loadNewTrack(urlObj.href);
            Root.Libs.Notify.show(
              `Captions toggled`,
              `Now using caption: ${lang}`,
            );
          });
        tempUiElems.push(row.elm.children);
      });

      openMenu(overlay, tempUiElems, () => {
        // Add scroll adjustment when navigating
        setTimeout(() => {
          let scrolled = false;
          for (const div of overlay.qsa(".flex-list")) {
            let button = div.elm.children[0];
            let focused = button.classList.contains("over");
            if (focused) {
              overlay.elm.scrollTop =
                div.elm.offsetTop +
                window.scrollY -
                overlay.elm.offsetHeight / 2 +
                50;
              scrolled = true;
            }
          }
          if (!scrolled) {
            overlay.elm.scrollTop = 0;
          }
        }, 50);
      });
      e.target.classList.remove("over");
    }

    function openPartyCaptionsMenu(captions, conn, partyName) {
      let overlay = new Html("div")
        .styleJs({
          width: "33.25rem",
          height: "600px",
          background: "rgba(0,0,0,0.5)",
          position: "absolute",
          top: "3.25rem",
          left: "3.25rem",
          zIndex: 1000000,
          backdropFilter: "blur(50px)",
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          padding: "25px",
          overflow: "scroll",
          scrollBehavior: "smooth",
          gap: "10px",
        })
        .appendTo(wrapper);
      new Html("h1").text("Captions").appendTo(overlay);
      new Html("p")
        .html(
          `Enable captions for <strong>${
            partyName ? partyName : "this watch party."
          }</strong>`,
        )
        .appendTo(overlay);
      new Html("br").appendTo(overlay);
      let tempUiElems = [];
      captions.forEach((caption, index) => {
        let fileName = caption.split(/.*[\/|\\]/)[1];
        let noExt = fileName.replace(/\.[^/.]+$/, "");
        let re = /(?:\.([^.]+))?$/;
        let lang = re.exec(noExt)[1]
          ? re.exec(noExt)[1]
          : "No language specified";
        console.log(caption);
        let row = new Html("div")
          .class("flex-list")
          .appendTo(overlay)
          .styleJs({ width: "100%" });
        new Html("button")
          .text(lang)
          .appendTo(row)
          .styleJs({ width: "100%" })
          .on("click", () => {
            console.log(index);
            conn.send({ type: "loadCaption", index: index });
          });
        tempUiElems.push(row.elm.children);
      });

      openMenu(overlay, tempUiElems, () => {
        // Add scroll adjustment when navigating
        setTimeout(() => {
          let scrolled = false;
          for (const div of overlay.qsa(".flex-list")) {
            let button = div.elm.children[0];
            let focused = button.classList.contains("over");
            if (focused) {
              overlay.elm.scrollTop =
                div.elm.offsetTop +
                window.scrollY -
                overlay.elm.offsetHeight / 2 +
                50;
              scrolled = true;
            }
          }
          if (!scrolled) {
            overlay.elm.scrollTop = 0;
          }
        }, 50);
      });
    }

    function handleUiNavigation(e) {
      if (e === "back") {
        pkg.end();
      }
      setTimeout(() => {
        let atTop = invButton.elm.classList.contains("over");
        if (atTop) {
          bottom.styleJs({ opacity: "0" });
          vidInfo.styleJs({ opacity: "0" });
          captionOverlay.styleJs({ bottom: "48px" });
        } else {
          bottom.styleJs({ opacity: "1" });
          vidInfo.styleJs({ opacity: "1" });
          captionOverlay.styleJs({ bottom: "calc(48px + 3rem)" });
        }
      }, 50);
    }

    let launchArgs = Root.Arguments[0];
    let captions = null;
    let autoplay =
      launchArgs.autoplay == undefined ? true : launchArgs.autoplay;
    if (launchArgs.app == "video") {
      let path = launchArgs.videoPath;
      if (!launchArgs.isOnline && !launchArgs.watchParty) {
        captions = await findCaptions(path);
      }
      let displayName = null;
      if (launchArgs.displayName) {
        displayName = launchArgs.displayName;
      }
      if (launchArgs.watchParty) {
        connectToParty(launchArgs.partyCode, launchArgs.partyName);
      } else {
        playVideo(path, captions, displayName, !launchArgs.isOnline, autoplay);
      }
    }
    console.log(vidInfo);
  },

  end: async function () {
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    Ui.giveUpUi(Pid);
    const audio = Sfx.getAudio();
    let playBgm = await window.localforage.getItem("settings__playBgm");
    if (playBgm) {
      audio.play();
    }
    wrapper.cleanup();
    document.removeEventListener("CherryTree.Ui.VolumeChange", volumeUpdate);
    document.dispatchEvent(
      new CustomEvent("CherryTree.VideoPlayer.Close", {
        detail: {
          destroyPeer: true,
        },
      }),
    );
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  },
};

export default pkg;
