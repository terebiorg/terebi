import Html from "/libs/html.js";

let wrapper, Ui, Parties, Pid, Sfx, curParty;
let endFunc;

const pkg = {
  name: "Parties Demo",
  type: "app",
  privs: 0,
  start: async function (Root) {
    Pid = Root.Pid;

    Ui = Root.Processes.getService("UiLib").data;

    wrapper = new Html("div").class("ui", "pad-top", "gap").appendTo("body");

    Ui.transition("popIn", wrapper);

    Ui.becomeTopUi(Pid, wrapper);

    Sfx = Root.Processes.getService("SfxLib").data;
    Parties = Root.Processes.getService("PartySvc").data;

    Sfx.playSfx("deck_ui_into_game_detail.wav");

    const Background = Root.Processes.getService("Background").data;

    console.log(Sfx);

    await Parties.registerGame({
      name: "Parties Demo",
      pid: Pid,
    });
    // curParty = await Parties.createParty("diddy party");
    // console.log(curParty);

    new Html("h1").text("Parties Demo").appendTo(wrapper);
    new Html("p")
      .text("Click on the button to open the overlay")
      .appendTo(wrapper);
    const row = new Html("div")
      .class("flex-list")
      .appendMany(
        new Html("button").text("Open overlay").on("click", (e) => {
          document.dispatchEvent(
            new CustomEvent("CherryTree.Parties.Overlay.Open"),
          );
        }),
        new Html("button").text("say hi").on("click", (e) => {
          alert("hallo every nyan");
        }),
      )
      .appendTo(wrapper);

    Ui.init(Pid, "horizontal", [row.elm.children], function (e) {
      if (e === "back") {
        pkg.end();
      }
    });
  },
  end: async function () {
    // Exit this UI when the process is exited
    // curParty.endParty();
    Parties.unregisterGame();
    Ui.cleanup(Pid);
    Sfx.playSfx("deck_ui_out_of_game_detail.wav");
    // await Ui.transition("popOut", wrapper);
    Ui.giveUpUi(Pid);
    wrapper.cleanup();
  },
};

export default pkg;
