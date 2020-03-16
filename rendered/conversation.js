const { ipcRenderer } = require('electron')
const $ = require("jquery");

var uuid;
console.log("POKDPOAKDPOKA")
ipcRenderer.on("conversation-init-channel", (e, data)=>{
  console.log(data)
})

function sendMessage() {
		let message = $("#message").val();
		$("#message").val('');
		if(message==null || message=="") return
	    ipcRenderer.send("send-message-channel", {"message": message, "uuid": uuid})
	}
$("#sendMessageBtn").on("click", (event)=>{
  sendMessage()
})
