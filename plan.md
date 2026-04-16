1. Add profile fields in HTML (bio and social media app): `index.html`. We already applied this partially, but we should make sure the input and display elements are there. Wait, we already did it successfully.
2. In `core.js`: Add variables `myBio` and `mySocialLink` locally. We successfully did this partially.
3. Expose them through the proxy state in `core.js`. We failed this. Let's do it cleanly by searching for where to put it.
4. Update `saveStats()` to include the bio and socialLink. We successfully did it!
5. Update `loadProfile()` to load `bio` and `socialLink` and set the HTML elements correctly. We successfully did it!
6. Update `script.js` to attach a click listener to save the profile info. We successfully did it!

Let's double check if we missed anything. I'll make sure `core.js`'s proxy export handles the `bio` and `socialLink`.
