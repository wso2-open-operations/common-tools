{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: window.location.origin, //"http://localhost:5173", 
    signOutRedirectURL: window.location.origin, //"http://localhost:5173",
    clientID: "8fTVImV7Fuv1uwgYQi_qj2fofWca", 
    baseUrl: "https://api.asgardeo.io/t/newtool",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;