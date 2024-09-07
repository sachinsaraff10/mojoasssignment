const express = require('express');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();

app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
},
    (accessToken, refreshToken, profile, done) => {
        return done(null, { profile, accessToken });
    }
));

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile', 'pages_show_list'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/profile');
    }
);

app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/facebook');
    }

    res.json(req.user);
    const user = req.user.profile;
    res.send(`
        <h1>Welcome ${user.displayName}</h1>
        <img src="${user.photos[0].value}" alt="Profile Picture">
        <form action="/pages" method="GET">
            <button type="submit">View Managed Pages</button>
        </form>
    `);
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});

app.get('/pages', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/facebook');
    }
    const accessToken = req.user.accessToken;
    try {
        const response = await axios.get(`https://graph.facebook.com/v12.0/me/accounts?access_token=${accessToken}`);
        const pages = response.data.data;
        let options = '';
        pages.forEach(page => {
            options += `<option value="${page.id}">${page.name}</option>`;
        });
        res.send(`
            <h1>Select a Page</h1>
            <form action="/insights" method="GET">
                <select name="page_id">${options}</select>
                <label for="since">Since:</label>
        <input type="date" id="since" name="since">
        <label for="until">Until:</label>
        <input type="date" id="until" name="until">
                <button type="submit">View Insights</button>
            </form>
        `);
    } catch (error) {
        res.status(500).send('Error fetching pages');
    }
});

app.get('/insights', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/auth/facebook');
    }
    const pageId = req.query.page_id;
    const accessToken = req.user.accessToken;
    const since = req.query.since; // YYYY-MM-DD
    const until = req.query.until; // YYYY-MM-DD


    try {
        const response = await axios.get(`https://graph.facebook.com/v12.0/${pageId}/insights?metric=page_fans,page_engaged_users,page_impressions,page_actions_post_reactions_total&access_token=${accessToken}&period=day`);
        const insights = response.data.data;
        let insightsHtml = '';
        insights.forEach(insight => {
            insightsHtml += `<div>
                                <h2>${insight.title}</h2>
                                <p>${insight.values[0].value}</p>
                            </div>`;
        });
        res.send(insightsHtml);
    } catch (error) {
        res.status(500).send('Error fetching insights');
    }
});
