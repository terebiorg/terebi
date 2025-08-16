import Html from "/libs/html.js";

let wrapper, Ui, Pid, Sfx;

const pkg = {
  name: "Recordings Viewer",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;
    Sfx = Root.Processes.getService("SfxLib").data;

    wrapper = new Html("div")
      .class("full-ui")
      .styleJs({
        display: "flex",
        flexDirection: "column", // Changed for a simpler top-down layout
        padding: "3rem",
        overflow: "hidden", // Main wrapper should not scroll
      })
      .appendTo("body");

    Ui.transition("popIn", wrapper);
    Ui.becomeTopUi(Pid, wrapper);
    Sfx.playSfx("deck_ui_into_game_detail.wav");

    new Html("h1")
      .text("My Recordings")
      .appendTo(wrapper)
      .styleJs({ marginBottom: "10px" });
    new Html("p")
      .text("Here are the shows you've recorded, organized by channel.")
      .appendTo(wrapper)
      .styleJs({
        opacity: 0.7,
        marginBottom: "2.5rem",
      });

    let contentWrapper = new Html("div")
      .styleJs({
        width: "100%",
        height: "100%",
        overflowY: "scroll",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        scrollBehavior: "smooth",
      })
      .appendTo(wrapper);

    let UiElems = [];
    const buttons = [];

    async function GetRecordings() {
      const url = `http://localhost:9864/list-recordings`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        console.error("Failed to fetch recordings:", err);
        return {}; // Return empty object on error
      }
    }

    function formatRecordingName(fileName) {
      // Removes the .mp4 extension and replaces underscores with spaces for readability
      return fileName.replace(/\.mp4$/, "").replace(/_/g, " ");
    }

    async function renderRecordings() {
      const recordingsByChannel = await GetRecordings();
      const fragment = document.createDocumentFragment();

      const imageStyle = {
        aspectRatio: "16 / 9",
        height: "85%",
        borderRadius: "5px",
        backgroundColor: "#2228",
        transition: "opacity 0.3s ease",
      };

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.style.opacity = "0";
                img.onload = () => {
                  img.style.opacity = "1";
                };
                img.onerror = () => {
                  img.style.opacity = "1";
                  img.style.backgroundColor = "#500";
                };
                observer.unobserve(img);
              }
            }
          });
        },
        { rootMargin: "50px" },
      );

      const channelNames = Object.keys(recordingsByChannel).sort();

      if (channelNames.length === 0) {
        fragment.appendChild(
          new Html("h3").text("No Recordings Found").styleJs({ opacity: 0.8 })
            .elm,
        );
      }

      for (const channelName of channelNames) {
        const recordings = recordingsByChannel[channelName];

        fragment.appendChild(
          new Html("h2").text(channelName).styleJs({ marginTop: "1.5rem" }).elm,
        );

        for (const item of recordings) {
          const row = new Html("div")
            .class("flex-list")
            .styleJs({ width: "100%" });

          const thumbnailURL = new URL("http://localhost:9864/thumbnail");
          thumbnailURL.searchParams.set("path", item.fullPath);

          const showPreview = new Html("img")
            .styleJs({ ...imageStyle, opacity: "0" })
            .attr({ "data-src": thumbnailURL.toString() });

          observer.observe(showPreview.elm);

          const showInfo = new Html("div").styleJs({
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            width: "60%",
            textAlign: "left",
          });

          new Html("p")
            .text(formatRecordingName(item.name))
            .appendTo(showInfo)
            .styleJs({ fontSize: "1.5em" });

          new Html("button")
            .appendMany(showPreview, showInfo)
            .styleJs({
              width: "100%",
              height: "150px",
              display: "flex",
              gap: "15px",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: "20px",
            })
            .appendTo(row)
            .on("click", async () => {
              Ui.transition("popOut", wrapper, 500, true);
              await Root.Libs.startPkg(
                "apps:VideoPlayer",
                [
                  {
                    app: "video",
                    videoPath: item.fullPath,
                    displayName: formatRecordingName(item.name),
                  },
                ],
                true,
              );
            });

          fragment.appendChild(row.elm);
          buttons.push(row);
          UiElems.push(row.elm.children);
        }
      }

      contentWrapper.elm.appendChild(fragment);

      // --- START: MODIFIED ---
      // Use the known-working "horizontal" mode. Because our data structure is an
      // array of single-item rows, this will correctly enable vertical navigation.
      Ui.init(Pid, "horizontal", UiElems, function (e) {
        if (e === "back") {
          pkg.end();
        }
        setTimeout(() => {
          for (const div of buttons) {
            let button = div.elm.children[0];
            let focused = button.classList.contains("over");
            if (focused) {
              contentWrapper.elm.scrollTop =
                div.elm.offsetTop +
                window.scrollY -
                window.innerHeight / 2 +
                75;
              break;
            }
          }
        }, 50);
      });
      // --- END: MODIFIED ---
    }

    renderRecordings();
  },
  end: async function () {
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;
