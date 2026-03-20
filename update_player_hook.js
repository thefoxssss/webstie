const fs = require('fs');
const content = fs.readFileSync('games/shadow-assassin-safe-rooms.html', 'utf8');

const diff = `<<<<<<< SEARCH
                if (this.grappling && this.grapplePoint) {
                    ctx.save();
                    ctx.strokeStyle = '#c0c0c0';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y - 6);
                    ctx.lineTo(this.grapplePoint.x, this.grapplePoint.y);
                    ctx.stroke();

                    ctx.fillStyle = '#ffd700';
                    ctx.beginPath();
                    ctx.arc(this.grapplePoint.x, this.grapplePoint.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
=======
                if (this.grappling && this.grapplePoint) {
                    ctx.save();

                    // Draw Chain
                    const dx = this.grapplePoint.x - this.x;
                    const dy = this.grapplePoint.y - (this.y - 6);
                    const dist = Math.hypot(dx, dy);
                    const angle = Math.atan2(dy, dx);

                    const linkLength = 8;
                    const numLinks = Math.floor(dist / linkLength);

                    ctx.strokeStyle = '#708090'; // Slate gray chain
                    ctx.lineWidth = 2;

                    for (let i = 0; i < numLinks; i++) {
                        const linkX = this.x + Math.cos(angle) * (i * linkLength);
                        const linkY = (this.y - 6) + Math.sin(angle) * (i * linkLength);

                        ctx.save();
                        ctx.translate(linkX, linkY);
                        // Alternate link rotation for 3D effect
                        ctx.rotate(angle + (i % 2 === 0 ? 0 : Math.PI / 4));
                        ctx.beginPath();
                        ctx.ellipse(0, 0, linkLength / 2, 2, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }

                    // Draw Anchor/Hook
                    ctx.translate(this.grapplePoint.x, this.grapplePoint.y);
                    ctx.rotate(angle);

                    ctx.fillStyle = '#4a5568'; // Darker gray metal
                    ctx.strokeStyle = '#2d3748';
                    ctx.lineWidth = 1;

                    // Main anchor shaft
                    ctx.fillRect(-6, -2, 12, 4);

                    // Crossbar
                    ctx.fillRect(-4, -6, 2, 12);

                    // The hook/claws
                    ctx.beginPath();
                    ctx.arc(4, 0, 8, -Math.PI/2, Math.PI/2, false);
                    ctx.lineTo(0, 6);
                    ctx.lineTo(0, -6);
                    ctx.fill();
                    ctx.stroke();

                    // Sharp tips
                    ctx.fillStyle = '#cbd5e0';
                    ctx.beginPath();
                    ctx.moveTo(4, -8);
                    ctx.lineTo(8, -8);
                    ctx.lineTo(4, -4);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(4, 8);
                    ctx.lineTo(8, 8);
                    ctx.lineTo(4, 4);
                    ctx.fill();

                    ctx.restore();
                }
>>>>>>> REPLACE`;

fs.writeFileSync('diff_hook.txt', diff);
