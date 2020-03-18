const { app, BrowserWindow, ipcMain, net, dialog } = require('electron')
const fs = require('fs')
var Stomp = require('stompjs')
var SockJS = require('sockjs-client')

var win,
    settings,
    user,
    sock,
    stompClient

init();

function init(){
  fs.readFile("./settings.json",'utf8', (err, data) => {
    if (err) throw err;
    settings = JSON.parse(data)
  });
  app.allowRendererProcessReuse = true;
  app.whenReady().then(createMainWindow)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

function createMainWindow () {
   win = new BrowserWindow({
    width: 700,
    height: 800,
    frame: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  if(user){
    win.loadFile('rendered/main.html')
  }else{
    win.loadFile('rendered/login.html')
  }
  win.webContents.openDevTools()
  win.on('closed', () =>{
    if(stompClient){
      stompClient.disconnect();
    }
    win = null;
  })
}

ipcMain.on("login-channel", (e, credential) =>{
  login(e, credential)
})

function login(e, credential){
  var postData = JSON.stringify(credential);
  request(`${settings.url}/authorize`, postData, "POST", {"content-type":"application/json"}, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      win.webContents.send('error-channel', data.message)
    }else{
      user=data.body
      user.password = credential.password
      win.loadFile('rendered/main.html')
      win.setTitle(`Communicator - ${user.nick}`)
    }
  }, (code, data)=>{
    win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

ipcMain.on("load-main-channel", (e) =>{
  sock= new SockJS(`${settings.url}/websocket`);
  stompClient = Stomp.over(sock);
  stompClient.connect({}, function (frame) {
      console.log('Connected: ' + frame);
      stompClient.subscribe(`/message/receiv/${user.id}`, processMessage);
  },(error)=>{console.log(error);});
  getContactsRequest(e.sender)
  getConferencesRequest(e.sender)
})

function getContactsRequest(e){
  request(`${settings.url}/contacts`, null, "GET", null, (chunk)=>{
    let data = JSON.parse(chunk)
    if(data.code!=200){
      e.send('error-channel', data.message)
    }else{
      e.send('users-channel', data.body)
    }
  }, (code, data)=>{
    e.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

function getConferencesRequest(e){
  request(`${settings.url}/conferences`, null, "GET", null, (chunk)=>{
    let data = JSON.parse(chunk)
    if(data.code!=200){
      e.send('error-channel', data.message)
    }else{
      e.send('conferences-channel', data.body)
    }
  }, (code, data)=>{
    e.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

ipcMain.on("init-conversation-channel", (e, data) =>{
  let callback = function(messages){
    e.sender.send("init-conversation-response-channel", JSON.stringify({"idUser": user.id, "messages": messages}))
  }
  getMessagesRequest(e.sender.uuid, 0, callback)
})

ipcMain.on("send-message-channel", (e, data) =>{
  try{
    stompClient.send("/app/message/send", {}, JSON.stringify({'content': data.message, 'writeTime': new Date().getTime(), 'idUser': user.id, 'uuidConversation': e.sender.uuid}));
  }catch(e){
    console.log(e)
  }
})

ipcMain.on("send-file-channel", (e, filename) =>{
  console.log(filename)
})

ipcMain.on("load-prev-messages-channel", (e, data) =>{
  console.log(data.offset);
  let callback = function(messages){
    e.sender.send("load-prev-messages-response-channel", JSON.stringify({"messages": messages}))
  }
  getMessagesRequest(e.sender.uuid, data.offset, callback)
})

var processMessage = function(messageResponse){
  let message = JSON.parse(messageResponse.body);
  let sendMessageToConversationView = (window)=>{
    window.webContents.send("message-comming-channel", message)
  }
  openConversation(message.uuidConversation, sendMessageToConversationView)
};

function getMessagesRequest(uuid, offset, callback){
  request(`${settings.url}/messages/get/${uuid}/${offset}`, null, "GET", null, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      console.log(data)
      win.webContents.send('error-channel', data.message)
    }else{
      callback(data.body)
    }
    }, (code, response)=>{
      win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
    })
}

ipcMain.on("open-conversation-channel", (e, uuid) =>{
  openConversation(uuid)
})

ipcMain.on("create-conversation-channel", (e, data) =>{
  createConversationByUserNicksRequest(data)
})

ipcMain.on("remove-user-from-conference-channel", (e, uuid) =>{
  request(`${settings.url}/conferences/users/remove`, uuid, "DELETE", null, (response)=>{
    getConferencesRequest(win.webContents)
    let found = findConversationWindow(uuid)
    if(found!=null){
      found.close();
    }
  }, (code, response)=>{
    win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
  })
})

function createConversationByUserNicksRequest(dataRequest){
  var postData = JSON.stringify(dataRequest);
  request(`${settings.url}/conferences/add`, postData, "POST", {"content-type":"application/json"}, (response)=>{
    let data = JSON.parse(response)
    if(data.code!=200){
      win.webContents.send('error-channel', data.message)
    }else{
      console.log(dataRequest.asConference)
      if(dataRequest.asConference){
        getConferencesRequest(win.webContents)
      }
      openConversation(data.body.uuid)
    }
    }, (code, response)=>{
      win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
    })
}

function openConversation(uuid, callbackAfterOpen){
  let found = findConversationWindow(uuid)
  if(found==null){
    let callback = (response)=>{
      let data = JSON.parse(response)
      if(data.code!=200){
        win.webContents.send('error-channel', data.message)
      }else{
        let conversation = data.body
        conversationWindow = new BrowserWindow({
         width: 700,
         height: 800,
         parent: win,
         title: conversation.name,
         resizable: false,
         webPreferences: {
           nodeIntegration: true
         }
       })
       conversationWindow.webContents.uuid = uuid
       conversationWindow.loadFile('rendered/conversation.html')
       conversationWindow.webContents.openDevTools()
       if(callbackAfterOpen instanceof Function)
        callbackAfterOpen(conversationWindow)
      }
    }
    getConversationRequest(uuid, callback)
 }else{
   found.show();
   if(callbackAfterOpen instanceof Function) {
     callbackAfterOpen(found)
   }
 }
}

function getConversationRequest(uuid, callback){
  request(`${settings.url}/conversations/get/${uuid}`, null, "GET", null, callback, (code, response)=>{
    win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
  })
}

ipcMain.on("search-message-channel", (e, data) =>{
  let callback = function(messages){
    let mess = JSON.parse(messages)
    e.sender.send("search-message-response-channel", mess.body)
  }
  searchMessageRequest(e.sender.uuid, data.content, callback)
})

function searchMessageRequest(uuid, content, callback){
  let conversation
  request(`${settings.url}/messages/search/${uuid}/${content}`, null, "GET", null, callback, (code, response)=>{
    win.webContents.send('error-channel', `Error: ${code}. Connection refused!`)
  })
  return conversation;
}

function findConversationWindow(uuid){
  let result = null
  BrowserWindow.getAllWindows().forEach(w=>{
    if(w.webContents.uuid==uuid){
      result = w;
    }
  })
  return result;
}

function request(url, postData, method, headers, success, error){
  const request = net.request({"url": url, method: method})
  request.on('login', (authInfo, callback) => {
    if(user){
      callback(user.nick, user.password)
    }else{
      win.loadFile('rendered/login.html')
    }
  })
  if(headers!=null){
    for (let [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }
  }
  request.on('response', (response) => {
    if(response.statusCode==200){
      var body = '';
      response.on('data', (chunk) => {
        body += chunk;

      })
      response.on('end', function () {
        success(body)
      });
    }else{
      var body = '';
      response.on('data', function (chunk) {
        body += chunk;
      });
      response.on('end', function () {
        error(response.statusCode, body)
      });
    }
  })
  if(postData){
    request.end(postData)
  }else{
      request.end()
  }
}
