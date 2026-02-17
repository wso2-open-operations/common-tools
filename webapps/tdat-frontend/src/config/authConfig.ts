{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: window.location.origin, //"http://localhost:5173", 
    signOutRedirectURL: window.location.origin, //"http://localhost:5173",
    clientID: "qUEmAQD9jPomyffHzNjjPV0ZjEca", 
    baseUrl: "https://api.asgardeo.io/t/tdattool",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;