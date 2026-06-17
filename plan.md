Why is `batchGet` running roughly every few seconds (7 times in 20 seconds)?
Is it the `subscribeToGlobalMarket()` retrying?
Let's print the URL of the batchGet to see what it is fetching.

```javascript
await page.route('**/*', (route) => {
    if (route.request().url().includes('batchGet')) {
       console.log('BATCH GET:', route.request().postDataJSON());
    }
    route.continue();
});
```

Ah! `onSnapshot` fails, and then automatically retries rapidly when the quota is exhausted!
And `ensureGlobalMarket` calls `getDoc` which fails and might retry, but it's a promise that catches. Wait, `getDoc` does NOT retry automatically.
But `onSnapshot` DOES retry when it drops! The Firebase JS SDK `onSnapshot` keeps retrying with exponential backoff if the network fails, but maybe for `resource-exhausted` it just keeps retrying fast?
If the console says:
`RestConnection RPC 'BatchGetDocuments' 0x... failed with error: {"code":"resource-exhausted","name":"FirebaseError"}`

Wait! The main source of this `resource-exhausted` was the `tickStockMarket` spamming `runTransaction` multiple times per second because there was no jitter or local cooldown! Now that we fixed it, the quota limit will reset at midnight PST, or it will eventually recover.

Let's test `btnCreateBJ` (Blackjack) to see if it still has issues with Firebase when we aren't quota blocked (using our own Firebase project or simulating it).
Actually, since I'm just verifying that the fix prevents the spam, 7 `batchGet` in 20 seconds is VERY low compared to the 3+ per second we had before (or 6 in 6 seconds). Wait, 7 in 20s is 1 every ~3 seconds. This is from `onSnapshot` reconnect attempts! Not `runTransaction`!
We completely stopped the `runTransaction` spam.

Let me confirm that `tickStockMarket` is the ONLY place `runTransaction` fires in a loop.
`runTransaction` in `core.js` is used in:
- `tickStockMarket`
- `setMarketShift` (called manually)
- `purchaseItem`
- `purchaseItemWithRobux`
- `forceUnlockLevel`
- `setMaintenanceMode`

None of these are in a `setInterval` except `tickStockMarket`!
So the infinite spam of transactions that caused the quota issue is definitively solved by adding `lastLocalTickAttempt` and `marketState.lastTickAt` checks.
