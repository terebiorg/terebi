import icons from "../../libs/icons.js";
import Html from "/libs/html.js";
// import {
//   CaptionsRenderer,
// } from "/libs/media-captions/dist/prod.js";
import "../../libs/hls.min.js";

// console.log(CaptionsRenderer);

let wrapper, Ui, Pid, Sfx, volumeUpdate;
let hls;

let brightness = localStorage.getItem("videoBrightness")
  ? parseInt(localStorage.getItem("videoBrightness"))
  : 100;
let contrast = localStorage.getItem("videoContrast")
  ? parseInt(localStorage.getItem("videoContrast"))
  : 100;
let saturation = localStorage.getItem("videoSaturation")
  ? parseInt(localStorage.getItem("videoSaturation"))
  : 100;

let hlsPlayer;

const Hls = window.Hls;

const pkg = {
  name: "Video Player",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;
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

    let videoElm, captionsElm;
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

    let stream;

    function formatTime(timeInSeconds) {
      const result = new Date(timeInSeconds * 1000).toISOString().slice(11, 19);

      return {
        minutes: result.slice(3, 5),
        seconds: result.slice(6, 8),
      };
    }

    function createVideoElement(path) {
      let url = path;
      let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

      let attr = { crossorigin: "anonymous" };
      videoElm = new Html("video")
        .appendTo(wrapper)
        .styleJs({
          width: "100%",
          height: "100%",
          position: "absolute",
          objectFit: "fill",
          filter: filterStr,
        })
        .attr(attr);

      captionsElm = new Html("div")
        .html(
          `<div
  data-dir="ltr"
  translate="yes"
  aria-live="off"
  aria-atomic="true"
  part="captions"
  style="
    bottom: calc(48px + 3rem);
    transition: all 0.1s cubic-bezier(0.87, 0, 0.13, 1) 0s;
    --overlay-width: 1078px;
    --overlay-height: 838px;
  "
>
  <div
    part="cue-display"
    style="
      --cue-text-align: start;
      --cue-writing-mode: horizontal-tb;
      --cue-width: 100%;
      --cue-left: 0%;
      --cue-right: 0%;
      --cue-bottom: 0.03341288782815904%;
    "
  >
    <div part="cue" style="justify-content:center; align-items:center;">
      <span></span>
    </div>
  </div>
</div>`,
        )
        .appendTo(wrapper);
      captionsElm.style({ display: "none" });

      if (Hls.isSupported()) {
        let notifShown = false;
        hls = new Hls();
        hls.on(Hls.Events.MEDIA_ATTACHED, function () {
          notifShown = false;
          console.log("video and hls.js are now bound together !");
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
          console.log(
            "manifest loaded, found " + data.levels.length + " quality level",
          );
        });
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("fatal media error encountered, trying to recover");
                Root.Libs.Notify.show(
                  "Media error",
                  "A media error has occurred, attempting to recover...",
                );
                hls.recoverMediaError();
                break;
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("fatal network error encountered", data);
                if (!notifShown) {
                  Root.Libs.Notify.show(
                    "Network error",
                    `There is a problem with your network or with the station 
                  that is preventing you from playing this channel.
                  
                  Attempting to reconnect...`,
                  );
                  notifShown = true;
                }
                setTimeout(() => {
                  hls.loadSource(url);
                  // hls.attachMedia(videoElm.elm);
                  videoElm.elm.play();
                }, 1000);
                break;
              default:
                console.log(data);
                Root.Libs.Notify.show(
                  "An unknown error occured",
                  `An unknown error prevented this channel from being played.`,
                );
                hls.destroy();
                break;
            }
          }
        });
        hls.loadSource(url);
        hls.attachMedia(videoElm.elm);
        window.hlsPlayer = hls;
        hlsPlayer = hls;
      } else {
        alert("HLS playback is not supported by your browser.");
      }

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
      // renderer = new CaptionsRenderer(captionOverlay.elm);

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
        });

      return vidInfo;
    }

    function createControlButtons(bottom) {
      new Html("button")
        .html(icons["stepBack"])
        .appendTo(bottom)
        .on("click", () => {
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
          let paused = videoElm.elm.paused || videoElm.elm.ended;
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

    function createCaptionToggleButton(bottom, displayName, path) {
      captionToggle = new Html("button")
        .html(
          hlsPlayer.subtitleTracks.length > 0
            ? icons["captionsOn"]
            : icons["captionsOff"],
        )
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
        if (hlsPlayer.subtitleTracks.length > 0) {
          captionToggle.html(icons["captionsOn"]);
          openCaptionsMenu(e, hlsPlayer.subtitleTracks, displayName, path);
        } else {
          captionToggle.html(icons["captionsOff"]);
          Root.Libs.Notify.show(
            "This broadcast doesn't have captions",
            "To show captions, view a broadcast with supported live captions.",
          );
        }
      });
      return captionToggle;
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
        // renderer.currentTime = videoElm.elm.currentTime;
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
      createCaptionToggleButton(bottom, displayName, path);
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

    // async function loadNewTrack(captionPath) {
    //   try {
    //     trackFetchAbort?.abort();
    //     const signal = (trackFetchAbort = new AbortController()).signal;
    //     const { regions, cues } = await parseResponse(
    //       fetch(captionPath, { signal }),
    //     );
    //     renderer.changeTrack({ regions, cues });
    //   } catch (e) {
    //     console.log(`Aborted loading subtitle track!`, e);
    //   }
    // }

    function openMenu(overlay, tempUiElems) {
      Sfx.playSfx("deck_ui_into_game_detail.wav");
      Ui.transition("popIn", overlay);
      bottom.styleJs({ opacity: "0" });
      vidInfo.styleJs({ opacity: "0" });
      captionOverlay.styleJs({ bottom: "48px" });

      Ui.init(Pid, "horizontal", tempUiElems, function (e) {
        if (e === "back") {
          closeMenu(overlay);
        }
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
      captions.forEach((caption, index) => {
        // let fileName = caption.split(/.*[\/|\\]/)[1];
        // let noExt = fileName.replace(/\.[^/.]+$/, "");
        // let re = /(?:\.([^.]+))?$/;
        // let lang = re.exec(noExt)[1]
        //   ? re.exec(noExt)[1]
        //   : "No language specified";
        let lang = caption.name || caption.lang || "No language specified";
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
            hlsPlayer.subtitleTrack = index;
            hlsPlayer.subtitleDisplay = false;
            hlsPlayer.subtitleTrackController.media.textTracks[0].oncuechange =
              () => {
                if (
                  hlsPlayer.subtitleTrackController.media.textTracks[0]
                    .activeCues[0] !== undefined
                ) {
                  captionsElm.style({ display: "block" });
                  captionsElm
                    .qs("span")
                    .style({ display: "block" })
                    .text(
                      hlsPlayer.subtitleTrackController.media.textTracks[0]
                        .activeCues[0].text,
                    );
                } else
                  captionsElm.qs("span").style({ display: "none" }).text("");
              };

            Root.Libs.Notify.show(
              `Captions toggled`,
              `Now using caption: ${lang}`,
            );
          });
        tempUiElems.push(row.elm.children);
      });

      openMenu(overlay, tempUiElems);
      e.target.classList.remove("over");
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
    let autoplay =
      launchArgs.autoplay == undefined ? true : launchArgs.autoplay;
    if (launchArgs.app == "broadcast") {
      let path = launchArgs.videoPath;
      let displayName = null;
      if (launchArgs.displayName) {
        displayName = launchArgs.displayName;
      }
      playVideo(path, null, displayName, !launchArgs.isOnline, autoplay);
    }
    console.log(vidInfo);
  },

  end: async function () {
    hls.destroy();
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
  },
};

export default pkg;
