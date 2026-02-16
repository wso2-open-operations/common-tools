{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: window.location.origin, //"http://localhost:5173", 
    signOutRedirectURL: window.location.origin, //"http://localhost:5173",
    clientID: "k18v4HF2HlbfJMpi6tSQlwsYA_0a", 
    baseUrl: "https://api.asgardeo.io/t/troubleshootingtools",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;