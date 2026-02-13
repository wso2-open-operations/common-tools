{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: "window.location.origin",
    signOutRedirectURL: "window.location.origin",
    clientID: "j3em6ItSw1yyDF8HIebWA0uzfT4a", 
    baseUrl: "https://api.asgardeo.io/t/tdat",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;