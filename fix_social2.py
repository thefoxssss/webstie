with open('script.js', 'r') as f:
    content = f.read()

import re

# Fix window.createSocialPost
content = re.sub(
    r'const \{ collection, addDoc, serverTimestamp \} = await import\("https://www\.gstatic\.com/firebasejs/10\.8\.0/firebase-firestore\.js"\);\s*const \{ db \} = await import\("./core\.js"\);\s*await addDoc\(collection\(db, "gooner_social_posts"\), {\s*author: state\.myName,\s*content: text,\s*timestamp: serverTimestamp\(\),\s*likes: 0\s*}\);',
    r'const { firebase } = await import("./core.js");\n    \n    await firebase.addDoc(firebase.collection(firebase.db, "gooner_social_posts"), {\n      author: state.myName,\n      content: text,\n      timestamp: Date.now(),\n      likes: 0\n    });',
    content
)

# Fix window.loadSocialFeed
content = re.sub(
    r'const \{ collection, query, orderBy, limit, getDocs \} = await import\("https://www\.gstatic\.com/firebasejs/10\.8\.0/firebase-firestore\.js"\);\s*const \{ db, escapeHtml \} = await import\("./core\.js"\);\s*const q = query\(collection\(db, "gooner_social_posts"\), orderBy\("timestamp", "desc"\), limit\(50\)\);\s*const snap = await getDocs\(q\);',
    r'const { firebase, escapeHtml } = await import("./core.js");\n    \n    const q = firebase.query(firebase.collection(firebase.db, "gooner_social_posts"), firebase.orderBy("timestamp", "desc"), firebase.limit(50));\n    const snap = await firebase.getDocs(q);',
    content
)

# Fix timestamp access
content = content.replace(
    'const time = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : "JUST NOW";',
    'const time = data.timestamp ? new Date(data.timestamp).toLocaleString() : "JUST NOW";'
)


with open('script.js', 'w') as f:
    f.write(content)
