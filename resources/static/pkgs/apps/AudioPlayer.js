import CustomInput from "../../libs/customInput.js";
import icons from "../../libs/icons.js";
import Html from "/libs/html.js";

let wrapper,
  Ui,
  Pid,
  Sfx,
  bg,
  gradientOverlay,
  volumeUpdate,
  customPlayerInput,
  playerInput,
  musicAudio,
  visualizer,
  audioMotion,
  colorThief,
  splitStr,
  base64URL,
  controller,
  styleSheet;

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
    let parsedLyrics = null,
      lyricLines = [],
      currentLyricIndex = -1;

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

    function getLyrics(title, artist) {
      return new Promise(async (resolve, reject) => {
        let urlObj = new URL("https://lrclib.net/api/search");
        urlObj.searchParams.append("track_name", title);
        urlObj.searchParams.append("artist_name", artist);
        let result = await fetch(urlObj.href).then((t) => t.json());
        console.log(urlObj.href);
        console.log(result);
        if (typeof result != "object") {
          reject("Invalid data received");
        }
        if (result.length == 0) {
          reject("Lyrics not found");
        }
        console.log(result[0]);
        resolve(result[0]);
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
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        boxSizing: "border-box",
      })
      .appendTo(wrapper);

    let contentArea = new Html("div")
      .class("content-area")
      .styleJs({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "90%",
        maxWidth: "1400px",
      })
      .appendTo(container);

    let leftPane = new Html("div")
      .styleJs({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "20px",
        flexShrink: 0,
        width: "20rem",
      })
      .appendTo(contentArea);

    let albumCover = new Html("img")
      .attr({
        src: "assets/img/maxresdefault.png",
      })
      .styleJs({
        width: "20rem",
        height: "20rem",
        aspectRatio: "1 / 1",
        objectFit: "cover",
        borderRadius: "8px",
      })
      .appendTo(leftPane);

    let songInfo = new Html("div")
      .styleJs({
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        textAlign: "left",
      })
      .appendTo(leftPane);

    let songTitle = new Html("h1")
      .text("Unknown song")
      .styleJs({ margin: 0, fontSize: "1.5rem" })
      .appendTo(songInfo);
    let songArtist = new Html("p")
      .text("Unknown artist")
      .styleJs({ margin: 0, fontSize: "1rem", opacity: 0.8 })
      .appendTo(songInfo);

    bg = new Html("img")
      .styleJs({
        zIndex: -3,
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
        zIndex: -2,
        position: "absolute",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "50%",
      })
      .appendTo("body");

    gradientOverlay = new Html("div")
      .styleJs({
        zIndex: -1,
        position: "absolute",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(to top, rgba(0, 0, 0, 0.7) 20%, rgba(0, 0, 0, 0) 60%)",
        pointerEvents: "none",
      })
      .appendTo("body");

    let lyricsContainer = new Html("div")
      .class("lyrics-container")
      .styleJs({
        height: "25rem",
        overflow: "hidden",
        position: "relative",
      })
      .appendTo(contentArea);

    let lyricsScroller = new Html("div")
      .styleJs({
        position: "absolute",
        width: "100%",
        top: "0",
        left: "0",
        transition: "transform 0.4s ease-in-out",
      })
      .appendTo(lyricsContainer);

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
        position: "absolute",
        bottom: "3rem",
        left: "50%",
        transform: "translateX(-50%)",
        width: "60%",
        maxWidth: "800px",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        borderRadius: "1rem",
        background: "rgba(0,0,0,0.5)",
      })
      .appendTo(wrapper);

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
      // Synced lyrics
      if (parsedLyrics && parsedLyrics.length > 0) {
        const currentTime = musicAudio.currentTime;
        let newIndex = -1;

        for (let i = parsedLyrics.length - 1; i >= 0; i--) {
          if (currentTime >= parsedLyrics[i].time) {
            newIndex = i;
            break;
          }
        }

        if (newIndex !== currentLyricIndex) {
          currentLyricIndex = newIndex;

          lyricLines.forEach((line, i) => {
            line.elm.classList.remove("active", "past");
            if (i < newIndex) {
              line.elm.classList.add("past");
            } else if (i === newIndex) {
              line.elm.classList.add("active");
            }
          });

          if (newIndex > -1) {
            const activeEl = lyricLines[newIndex].elm;
            const scrollerTopPadding = lyricsContainer.elm.clientHeight / 2;
            const scrollOffset =
              scrollerTopPadding -
              activeEl.offsetTop -
              activeEl.clientHeight / 2;
            lyricsScroller.styleJs({
              transform: `translateY(${scrollOffset}px)`,
            });
          } else {
            lyricsScroller.styleJs({
              transform: "translateY(0px)",
            });
          }
        }
      }
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

    function parseLRC(lrcText) {
      if (!lrcText) return [];
      const lines = lrcText.split("\n");
      const lyrics = [];
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
      for (const line of lines) {
        const match = line.match(timeRegex);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
          const time = minutes * 60 + seconds + milliseconds / 1000;
          const text = line.replace(timeRegex, "").trim();
          if (text) {
            lyrics.push({ time, text });
          }
        }
      }
      return lyrics;
    }

    function toggleLyricsDisplay() {
      contentArea.elm.classList.toggle("lyrics-active");
    }

    getLyrics(tag.tags.title, tag.tags.artist)
      .then((lyricInfo) => {
        if (lyricInfo && lyricInfo.syncedLyrics) {
          parsedLyrics = parseLRC(lyricInfo.syncedLyrics);
          lyricsScroller.html("");
          lyricLines = [];
          if (parsedLyrics.length > 0) {
            contentArea.elm.classList.add("lyrics-active");

            createButton(icons["sing"], toggleLyricsDisplay).appendTo(
              controlButtons,
            );
            Ui.update(Pid, [controlButtons.elm.children]);

            const topPadding = lyricsContainer.elm.clientHeight / 2;
            lyricsScroller.styleJs({
              paddingTop: `${topPadding}px`,
              paddingBottom: `${topPadding}px`,
            });
            parsedLyrics.forEach((line) => {
              const p = new Html("p")
                .text(line.text)
                .styleJs({
                  margin: "0 0 1.5rem 0",
                  lineHeight: "1.2",
                  transition:
                    "transform 0.3s ease, color 0.3s ease, font-size 0.3s ease, opacity 0.3s ease, filter 0.3s ease",
                  fontSize: "2.5rem",
                  fontWeight: "500",
                  color: "rgba(255, 255, 255, 0.7)",
                })
                .appendTo(lyricsScroller);

              p.elm.classList.add("lyric-line");
              lyricLines.push(p);
            });
          }
        }
      })
      .catch((errorMessage) => {
        console.error(errorMessage);
        lyricsScroller.html(""); // Clear lyrics on error
      });

    styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .content-area {
            gap: 0;
            justify-content: center;
            transition: gap 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .content-area.lyrics-active {
            gap: 60px;
        }

        .lyrics-container {
            width: 0;
            opacity: 0;
            flex-shrink: 0;
            transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .content-area.lyrics-active .lyrics-container {
            width: 45rem;
            opacity: 1;
        }

        .lyric-line.active {
            color: #FFFFFF !important;
            font-size: 3.5rem !important;
            font-weight: bold !important;
        }
        .lyric-line.past {
            color: rgba(255, 255, 255, 0.5) !important;
            font-size: 2.5rem !important;
            filter: blur(2px);
        }
    `;
    document.head.appendChild(styleSheet);

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
    if (styleSheet) {
      styleSheet.remove();
      styleSheet = null;
    }
    controller.destroy();
    audioMotion.destroy();
    visualizer.cleanup();
    gradientOverlay.cleanup();
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
