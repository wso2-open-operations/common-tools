{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: window.location.origin, //"http://localhost:5173", 
    signOutRedirectURL: window.location.origin, //"http://localhost:5173",
    clientID: "ljAEYPjEWlP2r1gxTUfMIXrFhUIa", 
    baseUrl: "https://api.asgardeo.io/t/cstroubleshootingtools",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;