import Html from "/libs/html.js";

let wrapper, Ui, Pid, Sfx, card;

const pkg = {
  name: "Onboarding",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;
    Ui = Root.Processes.getService("UiLib").data;
    Sfx = Root.Processes.getService("SfxLib").data;
    let launchArgs = Root.Arguments[0];

    console.log("Onboarding launch args", launchArgs);

    wrapper = new Html("div")
      .class("full-ui", "flex-col")
      .styleJs({
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at center, #2c3e50 0%, #000000 70%)",
      })
      .appendTo("body");

    card = new Html("div").class("onboarding-card").appendTo(wrapper).styleJs({
      backgroundColor: "var(--background-default)",
      border: "0.1rem solid var(--background-lighter)",
      boxShadow: "0 0 0.5rem 0 var(--current-player)",
      borderRadius: "0.8rem",
      padding: "3rem 4rem",
      display: "flex",
      alignItems: "center",
      gap: "4rem",
      animation: "fadeIn 0.3s ease-out forwards",
    });

    let contentContainer = new Html("div")
      .styleJs({
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "10px",
      })
      .appendTo(card);

    Ui.transition("popIn", wrapper);
    Ui.becomeTopUi(Pid, wrapper);
    Sfx.playSfx("deck_ui_show_modal.wav");

    let ip;
    try {
      let a = await fetch("http://localhost:9864/local_ip").then((t) =>
        t.text(),
      );
      ip = a;
    } catch (e) {
      ip = "127.0.0.1";
    }

    new Html("h1").text("Connect to Continue").appendTo(contentContainer);
    new Html("p")
      .text("Connect a controller, keyboard, or remote.")
      .styleJs({ opacity: 0.8 })
      .appendTo(contentContainer);
    new Html("br").appendTo(contentContainer);

    const okButton = new Html("button").text("OK").on("click", async (e) => {
      Sfx.playSfx("deck_ui_into_game_detail.wav");
      pkg.end();
      setTimeout(async () => {
        await Root.Libs.startPkg(
          launchArgs.redirectTo,
          launchArgs.launchArguments,
        );
      }, 500);
    });

    const row = new Html("div").append(okButton).appendTo(contentContainer);

    if ((await window.localforage.getItem("settings__phoneLink")) === true) {
      new Html("img")
        .attr({
          src: `http://127.0.0.1:9864/qr?url=${location.protocol}//${ip}:${location.port}/link/index.html?code=${window.phoneLinkCode}`,
        })
        .styleJs({
          borderRadius: "1rem",
          width: "14rem",
          height: "14rem",
          imageRendering: "pixelated",
          border: "4px solid white",
        })
        .appendTo(card);
    } else {
      contentContainer.styleJs({
        alignItems: "center",
        textAlign: "center",
      });
    }

    Ui.init(Pid, "horizontal", [row.elm.children]);
  },
  end: async function () {
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_hide_modal.wav");
    Ui.giveUpUi(Pid);
    wrapper.styleJs({ animation: "fadeOut 0.5s ease-out forwards" });
    setTimeout(() => {
      wrapper.cleanup();
    }, 300);
  },
};

export default pkg;
