const { ipcRenderer } = require('electron')
const $ = require("jquery");

ipcRenderer.send("load-main-channel")

ipcRenderer.on("users-channel", (e, users)=>{
  users.forEach(user=>{
    addUser(user)
  })
})
ipcRenderer.on("error-channel", (e, error)=>{
  console.log(error)
})

function addUser(user){
  let tr = document.createElement('tr');
  let td = document.createElement('td');
  let i = document.createElement('i');
  tr.id="tr-"+user.nick
  td.classList+="noselect pointer color-text"
  i.classList+="demo-icon icon-anonymous";
  td.textContent=user.nick
  td.insertBefore(i, td.firstChild);
  tr.addEventListener('click', (event)=>{
    if (tr.getAttribute("data-dblclick") == null) {
			tr.setAttribute("data-dblclick", 1);
			setTimeout(function() {
				if (tr.getAttribute("data-dblclick") == 1) {
					toggleUser(tr, user.nick);
					if( $("#conversationUsers").children().length > 1) {
					       $("#conversationControl").show()
					}else{
					       $("#conversationControl").hide()
					}
				}
				tr.removeAttribute("data-dblclick");
			}, 300);
		} else {
			tr.removeAttribute("data-dblclick");
			let nicks = [];
			nicks.push(user.nick)
			clearUserList();
			createConversation(nicks, user.nick)
		}
  })
  tr.appendChild(td)
  $("#users").append(tr);
}

function toggleUser(element, nick) {
		if ($('#conversationUsers').find('#nick-' + nick).length == 1) {
			removeUserFromConference(nick)
			$(element).removeClass("selected")
		} else {
			addUserToConference(nick)
			$(element).addClass("selected")
		}
}

function addUserToConference(nick) {
	let a = document.createElement('a');
	a.textContent = nick
	a.href="#"
	a.id="nick-"+nick
	a.classList+="badge badge-dark"
	a.onclick=function(event){
		$(event.target).remove();
		$("#tr-"+nick).removeClass("selected")
		if( $('#conversationList').children().length > 1) {
			$("#conversationControl").show()
		}else{
			$("#conversationControl").hide();
		}
	}
	$('#conversationUsers').append(a);
}

function removeUserFromConference(nick) {
	$("#nick-"+nick).remove();
}

function clearUserList() {
	$(".selected").removeClass("selected")
	$("#conversationControl").hide()
	$('#conversationUsers').empty();
	$("input[name='conversationName']").val("")
}

ipcRenderer.on("conferences-channel", (e, conferences)=>{
  conferences.forEach(conference=>{
    addConference(conference)
  })
})

function addConference(conference){
  let tr = document.createElement('tr');
  let td = document.createElement('td');
  let i = document.createElement('i');
  let aRemove = document.createElement('a');
  let iRemove = document.createElement('i');
  td.classList+="noselect pointer color-text conference"
  i.classList+="demo-icon icon-anonymouses";
  td.textContent=conference.name
  td.insertBefore(i, td.firstChild);
  td.addEventListener("dblclick", (event)=>{
    ipcRenderer.send("open-conversation-channel", conference)
  })
  aRemove.href="#"
  aRemove.style.float="right"
  aRemove.addEventListener("click", (event)=>{
    ipcRenderer.send("remove-user-from-conference-channel", conference)
  })
  iRemove.classList+="demo-icon icon-user-delete delete-btn"
  aRemove.appendChild(iRemove)
  td.appendChild(aRemove)
  tr.appendChild(td)
  users.appendChild(tr);
}

function createConferenceBtnClick(){
		let childs = $("#conversationUsers").children()
		let users = []
		for (var i = 0; i < childs.length; i++){
		    users.push(childs[i].id.replace('nick-',''));
		}
		createConference(users, $("input[name='conversationName']").val())
	}

function createConversation(users, conversationName){
  ipcRenderer.send("create-conversation-channel", {"nicks": users, "name": conversationName, "isConference": false})
}

function createConference(users, conversationName){
  ipcRenderer.send("create-conference-channel", {"nicks": users, "name": conversationName})
}

ipcRenderer.on("remove-user-from-conference-response-channel", (e, response)=>{
  console.log(response)
})
