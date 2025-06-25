import CustomInput from "../../libs/customInput.js";
import icons from "../../libs/icons.js";
import Html from "/libs/html.js";

let wrapper,
  Ui,
  Pid,
  Sfx,
  bg,
  volumeUpdate,
  customPlayerInput,
  playerInput,
  musicAudio,
  visualizer,
  audioMotion,
  colorThief,
  splitStr,
  base64URL,
  controller;

const pkg = {
  name: "Audio Player",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;

    wrapper = new Html("div").class("full-ui").appendTo("body");

    window.desktopIntegration !== undefined &&
      window.desktopIntegration.ipc.send("setRPC", {
        details: "Listening to music",
      });

    Ui.transition("popIn", wrapper);

    Ui.becomeTopUi(Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;
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

    const Background = Root.Processes.getService("Background").data;
    colorThief = new ColorThief();

    let launchArgs = Root.Arguments[0];
    let autoplay =
      launchArgs.autoplay == undefined ? true : launchArgs.autoplay;

    let jsmediatags = window.jsmediatags;

    function getTags(file) {
      return new Promise((resolve, reject) => {
        let urlObj = new URL("http://127.0.0.1:9864/getFile");
        urlObj.searchParams.append("path", file);
        jsmediatags.read(urlObj.href, {
          onSuccess: function (tag) {
            resolve(tag);
          },
          onError: function (error) {
            reject(error);
          },
        });
      });
    }

    console.log(launchArgs);
    let tag = {
      tags: {},
    };
    try {
      tag = await getTags(launchArgs.audioPath);
    } catch (e) {
      console.log("Tag error", e);
    }
    let fileName = launchArgs.audioPath.split(/.*[\/|\\]/)[1];
    let playerSong = fileName.replace(/\.[^/.]+$/, "");
    let playerArtist = "Unknown artist";
    console.log(tag);

    console.log(Sfx);

    let container = new Html("div")
      .styleJs({
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
      })
      .appendTo(wrapper);

    let songDisplay = new Html("div")
      .styleJs({
        display: "flex",
        gap: "20px",
        alignItems: "center",
        justifyContent: "center",
      })
      .appendTo(container);

    let albumCover = new Html("img")
      .attr({
        src: "assets/img/maxresdefault.png",
      })
      .styleJs({
        width: "15rem",
        height: "15rem",
        aspectRatio: "1 / 1",
        objectFit: "cover",
        borderRadius: "8px",
      })
      .appendTo(songDisplay);

    bg = new Html("img")
      .styleJs({
        zIndex: -1,
        filter: "blur(100px) brightness(35%)",
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        opacity: "0",
        aspectRatio: "16 / 9",
        objectFit: "cover",
        transition: "all 0.2s linear",
      })
      .appendTo("body");

    visualizer = new Html("div")
      .attr({ width: window.innerWidth, height: window.innerHeight / 2 })
      .styleJs({
        zIndex: -1,
        position: "absolute",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "50%",
      })
      .appendTo("body");

    let songInfo = new Html("div")
      .styleJs({ display: "flex", flexDirection: "column", gap: "10px" })
      .appendTo(songDisplay);

    let songTitle = new Html("h1").text("Unknown song").appendTo(songInfo);
    let songArtist = new Html("p").text("Unknown artist").appendTo(songInfo);

    function blobToBase64(blob) {
      return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          let base64data = reader.result;
          base64data = base64data.substr(base64data.indexOf(",") + 1);
          base64data = "data:image/jpeg;base64," + base64data;
          resolve(base64data);
        };
        reader.readAsDataURL(blob);
      });
    }

    if ("title" in tag.tags) {
      playerSong = tag.tags.title;
    }
    if ("artist" in tag.tags) {
      playerArtist = tag.tags.artist;
    }
    if ("album" in tag.tags) {
      playerArtist = playerArtist + " • " + tag.tags.album;
    } else {
      playerArtist = playerArtist + " • " + "Unknown album";
    }
    if ("year" in tag.tags) {
      playerArtist = playerArtist + " • " + tag.tags.year;
    }
    let dataURL;
    if ("picture" in tag.tags) {
      let buf = new Uint8Array(tag.tags.picture.data);
      let blob = new Blob([buf]);
      console.log(blob);
      // dataURL = URL.createObjectURL(blob);
      base64URL = await blobToBase64(blob);
      console.log(base64URL);
      albumCover.elm.src = base64URL;
      bg.elm.src = base64URL;
      setTimeout(() => {
        bg.styleJs({
          opacity: "1",
        });
      }, 200);
    }

    songTitle.text(playerSong);
    songArtist.text(playerArtist);

    function createButton(content, callback) {
      return new Html("button").html(content).on("click", callback).styleJs({
        minWidth: "3.25rem",
        height: "3.25rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.8rem",
      });
    }

    function formatTime(timeInSeconds) {
      const result = new Date(timeInSeconds * 1000).toISOString().slice(11, 19);

      return {
        minutes: result.slice(3, 5),
        seconds: result.slice(6, 8),
      };
    }

    let playerControls = new Html("div")
      .styleJs({
        width: "50%",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        borderRadius: "1rem",
        background: "rgba(0,0,0,0.5)",
      })
      .appendTo(container);

    let progressInd = new Html("div")
      .styleJs({
        display: "flex",
        gap: "15px",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
      })
      .appendTo(playerControls);

    let timeElapsed = new Html("span")
      .styleJs({ fontSize: "1.3rem" })
      .text("00:00");
    let timeLength = new Html("span")
      .styleJs({ fontSize: "1.3rem" })
      .text("00:00");

    timeElapsed.appendTo(progressInd);

    let progress = new Html("div")
      .class("vp-progress-bar")
      .style({
        "flex-grow": "1",
      })
      .appendTo(progressInd);

    timeLength.appendTo(progressInd);

    let progressBarValue = new Html("div")
      .class("vp-progress-bar-value")
      .appendTo(progress);

    let controlButtons = new Html("div")
      .styleJs({
        display: "flex",
        gap: "15px",
        alignItems: "center",
        justifyContent: "center",
      })
      .appendTo(playerControls);

    let urlObj = new URL("http://127.0.0.1:9864/getFile");
    urlObj.searchParams.append("path", launchArgs.audioPath);
    musicAudio = new Audio(urlObj.href);
    musicAudio.crossOrigin = "anonymous";
    let songDuration = 0;

    function updateProgressValue(val) {
      progressBarValue.style({ width: `${val}%` });
    }

    musicAudio.addEventListener("loadedmetadata", () => {
      songDuration = Math.round(musicAudio.duration);
      const time = formatTime(songDuration);
      timeLength.text(`${time.minutes}:${time.seconds}`);
      updateProgressValue(0);
    });

    musicAudio.addEventListener("timeupdate", () => {
      const duration = formatTime(songDuration);
      const songElapsed = Math.round(musicAudio.currentTime);
      const elapsed = formatTime(songElapsed);
      timeElapsed.text(`${elapsed.minutes}:${elapsed.seconds}`);
      timeLength.text(`${duration.minutes}:${duration.seconds}`);
      updateProgressValue((musicAudio.currentTime / musicAudio.duration) * 100);
      document.dispatchEvent(
        new CustomEvent("CherryTree.Media.UpdatePosition", {
          detail: {
            duration: musicAudio.duration,
            playbackRate: 1,
            position: musicAudio.currentTime,
          },
        }),
      );
      // Will be added for synced lyrics
      // renderer.currentTime = musicAudio.elm.currentTime;
    });

    musicAudio.volume = Sfx.getVolume();
    volumeUpdate = (e) => {
      musicAudio.volume = e.detail / 100;
    };
    document.addEventListener("CherryTree.Ui.VolumeChange", volumeUpdate);

    let skipBack = createButton(icons["stepBack"], function () {
      let currentAudioTime = musicAudio.currentTime
        ? musicAudio.currentTime
        : 0;
      let newTime = currentAudioTime - 10;
      if (newTime < 0) {
        newTime = 0;
      }
      musicAudio.currentTime = newTime;
    }).appendTo(controlButtons);
    let playButton = createButton(icons["play"], function () {
      if (musicAudio.paused) {
        musicAudio.play();
      } else {
        musicAudio.pause();
      }
    }).appendTo(controlButtons);
    let skipForward = createButton(icons["stepForward"], function () {
      let currentAudioTime = musicAudio.currentTime
        ? musicAudio.currentTime
        : 0;
      let newTime = currentAudioTime + 10;
      if (newTime > songDuration) {
        newTime = songDuration;
      }
      musicAudio.currentTime = newTime;
    }).appendTo(controlButtons);

    musicAudio.addEventListener("play", () => {
      playButton.html(icons["pause"]);
      document.dispatchEvent(
        new CustomEvent("CherryTree.Media.UpdatePlayState", {
          detail: "playing",
        }),
      );
      stopBgm();
    });

    musicAudio.addEventListener("pause", () => {
      playButton.html(icons["play"]);
      document.dispatchEvent(
        new CustomEvent("CherryTree.Media.UpdatePlayState", {
          detail: "paused",
        }),
      );
      playBgm();
    });

    playerInput = (e) => {
      let action = e.detail;
      if (action.type === "pause") {
        musicAudio.pause();
      }
      if (action.type === "play") {
        musicAudio.play();
      }
    };

    customPlayerInput = () => {
      if (musicAudio.paused) {
        musicAudio.play();
        stopBgm();
      } else {
        musicAudio.pause();
        playBgm();
      }
    };

    document.addEventListener("AudioPlayer.PlayPause", customPlayerInput);
    document.addEventListener("CherryTree.Media.PlayerAction", playerInput);

    musicAudio.addEventListener("canplaythrough", () => {
      window.desktopIntegration !== undefined &&
        window.desktopIntegration.ipc.send("setRPC", {
          details: playerSong,
          state: playerArtist,
        });
      // splitStr = playerArtist.split(" • ");
      // document.dispatchEvent(
      //   new CustomEvent("CherryTree.Media.UpdateMetadata", {
      //     detail: {
      //       title: playerSong,
      //       artist: splitStr[0],
      //       album: splitStr[1],
      //     },
      //   }),
      // );
      if (autoplay) {
        musicAudio.play();
      }
    });

    // wip
    // VERY PERFORMANCE HEAVY!

    function startVisualizer() {
      splitStr = playerArtist.split(" • ");
      console.log("dispatching event");
      if (base64URL) {
        document.dispatchEvent(
          new CustomEvent("CherryTree.Media.UpdateMetadata", {
            detail: {
              title: playerSong,
              artist: splitStr[0],
              album: splitStr[1],
              artwork: [{ src: base64URL }],
            },
          }),
        );
      } else {
        document.dispatchEvent(
          new CustomEvent("CherryTree.Media.UpdateMetadata", {
            detail: {
              title: playerSong,
              artist: splitStr[0],
              album: splitStr[1],
            },
          }),
        );
      }
      controller = new CustomInput({
        wrapperStyles: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
        },
        elements: {
          background: {
            type: "div",
            text: "",
            style: {
              position: "fixed",
              top: "0",
              left: "0",
              width: "100%",
              height: "100%",
              zIndex: "0",
              background: `url(${base64URL})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(50px) brightness(50%)",
            },
          },
          nowPlaying: {
            type: "p",
            text: "Now playing",
            style: { textAlign: "center", zIndex: "10", maxWidth: "80%" },
          },
          albumCover: {
            type: "img",
            text: "",
            attr: {
              src: base64URL,
            },
            style: {
              width: "50%",
              aspectRatio: "1 / 1",
              objectFit: "cover",
              zIndex: "10",
              borderRadius: "10px",
            },
          },
          songName: {
            type: "h1",
            text: playerSong,
            style: { textAlign: "center", zIndex: "10", maxWidth: "80%" },
          },
          songArtist: {
            type: "p",
            text: playerArtist,
            style: { textAlign: "center", zIndex: "10", maxWidth: "80%" },
          },
          playPause: {
            type: "button",
            text: "Play/pause",
            style: { zIndex: "10" },
            events: {
              click: "AudioPlayer.PlayPause",
            },
          },
        },
      });

      controller.register();

      let color = colorThief.getColor(albumCover.elm);
      console.log("colors", color);
      let colorMain = `rgb(${color[0] + 50},${color[1] + 50}, ${
        color[2] + 50
      })`;
      let colorArr = `${color[0] + 50},${color[1] + 50}, ${color[2] + 50},`;
      let colorDark = `rgb(${color[0]},${color[1]}, ${color[2]})`;
      albumCover.styleJs({
        boxShadow: `2.8px 2.8px 2.2px rgba(${colorArr}0.02),
  6.7px 6.7px 5.3px rgba(${colorArr}0.028),
  12.5px 12.5px 10px rgba(${colorArr}0.035),
  22.3px 22.3px 17.9px rgba(${colorArr}0.042),
  41.8px 41.8px 33.4px rgba(${colorArr}0.05),
  100px 100px 80px rgba(${colorArr}0.07)`,
      });
      audioMotion = new AudioMotionAnalyzer(visualizer.elm, {
        // canvas: visualizer.elm,
        source: musicAudio,
        ansiBands: false,
        showScaleX: false,
        bgAlpha: 0,
        overlay: true,
        mode: 5,
        frequencyScale: "log",
        radial: false,
        showPeaks: false,
        channelLayout: "single-vertical",
        smoothing: 0.7,
        volume: 0.5,
        height: window.innerHeight / 2,
      });
      audioMotion.registerGradient("classic", {
        dir: "v",
        colorStops: [colorMain, colorDark],
      });
    }

    if (albumCover.elm.complete) {
      startVisualizer();
    } else {
      albumCover.elm.addEventListener("load", startVisualizer);
    }

    Ui.init(Pid, "horizontal", [controlButtons.elm.children], function (e) {
      if (e === "back") {
        pkg.end();
      }
    });
  },
  end: async function () {
    controller.destroy();
    audioMotion.destroy();
    visualizer.cleanup();
    musicAudio.pause();
    musicAudio = null;
    document.removeEventListener("CherryTree.Ui.VolumeChange", volumeUpdate);
    document.removeEventListener("CherryTree.Media.PlayerAction", playerInput);
    document.removeEventListener("AudioPlayer.PlayPause", customPlayerInput);
    bg.styleJs({ opacity: "0" });
    setTimeout(() => {
      bg.cleanup();
    }, 200);
    // Exit this UI when the process is exited
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    // await Ui.transition("popOut", wrapper);
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;
