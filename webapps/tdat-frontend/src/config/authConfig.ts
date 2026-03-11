{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: window.location.origin, //"http://localhost:5173", 
    signOutRedirectURL: window.location.origin, //"http://localhost:5173",
    clientID: "DgOk57ldcAHBDzKazv2KJJY17XEa", 
    baseUrl: "https://api.asgardeo.io/t/wso2",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;