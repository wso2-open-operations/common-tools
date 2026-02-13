{/* Asgardeo related Configs*/}
const authConfig = {
    signInRedirectURL: "window.location.origin", //"http://localhost:5173", 
    signOutRedirectURL: "window.location.origin", //"http://localhost:5173",
    clientID: "L834YQBrvfLdyBsUvXLjzg_4iaMa", 
    baseUrl: "https://api.asgardeo.io/t/cstools",
    scope: [ "openid", "email", "profile" ]
};

export default authConfig;