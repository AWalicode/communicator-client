const { ipcRenderer } = require('electron')



let loginButton = document.getElementById("login-button")
    username = document.getElementById("username");
    password = document.getElementById("password");
    error = document.getElementById("login-error");

loginButton.addEventListener('click', ()=>{
  if(username.value && password.value){
    ipcRenderer.send("login-channel", {"nick": username.value, "password": password.value})
    loginButton.disabled=true;
  }
})

password.addEventListener("keyup", (event)=>{
  if (event.keyCode === 13) {
    event.preventDefault();
    loginButton.click();
  }
})

ipcRenderer.on("error-channel", (e, message)=>{
  error.textContent = message
})
