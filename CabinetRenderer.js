class CabinetRenderer {

    constructor(game){
        this.game = game;
    }

    draw(ctx,W,H){

        this.drawWoodBackground(ctx,W,H);
        this.drawOuterFrame(ctx,W,H);
        this.drawInnerGlow(ctx,W,H);

    }

    drawWoodBackground(ctx,W,H){

        const wood = ctx.createLinearGradient(0,0,0,H);

        wood.addColorStop(0,"#6e3818");
        wood.addColorStop(.25,"#5b2b12");
        wood.addColorStop(.55,"#44200d");
        wood.addColorStop(1,"#281208");

        ctx.fillStyle=wood;
        ctx.fillRect(0,0,W,H);

        // wood grain

        ctx.save();

        ctx.globalAlpha=.08;

        for(let y=0;y<H;y+=5){

            ctx.beginPath();

            ctx.strokeStyle=(y%10===0)
                ?"rgba(255,220,180,.18)"
                :"rgba(0,0,0,.25)";

            ctx.lineWidth=1;

            ctx.moveTo(0,y);

            ctx.bezierCurveTo(
                W*.25,
                y+Math.sin(y*.03)*6,

                W*.75,
                y+Math.cos(y*.025)*5,

                W,
                y
            );

            ctx.stroke();

        }

        ctx.restore();

        // spotlight

        const light=ctx.createRadialGradient(
            W/2,
            H*.42,
            20,

            W/2,
            H*.42,
            W*.55
        );

        light.addColorStop(0,"rgba(255,220,140,.28)");
        light.addColorStop(.5,"rgba(255,180,70,.08)");
        light.addColorStop(1,"rgba(255,180,70,0)");

        ctx.fillStyle=light;
        ctx.fillRect(0,0,W,H);

    }

    drawOuterFrame(ctx,W,H){

        const m=18;

        // dark wood

        const wood=ctx.createLinearGradient(
            0,
            0,
            0,
            H
        );

        wood.addColorStop(0,"#6b3b19");
        wood.addColorStop(.5,"#4d240d");
        wood.addColorStop(1,"#2b1208");

        ctx.fillStyle=wood;

        ctx.fillRect(0,0,W,m);
        ctx.fillRect(0,H-m,W,m);

        ctx.fillRect(0,0,m,H);
        ctx.fillRect(W-m,0,m,H);

        // gold strip

        ctx.strokeStyle="#ffd84d";
        ctx.lineWidth=3;

        ctx.shadowColor="#ffd84d";
        ctx.shadowBlur=15;

        ctx.strokeRect(
            m,
            m,
            W-m*2,
            H-m*2
        );

        ctx.shadowBlur=0;

        // second line

        ctx.strokeStyle="#8b5d15";

        ctx.lineWidth=1;

        ctx.strokeRect(
            m+7,
            m+7,
            W-(m+7)*2,
            H-(m+7)*2
        );

    }

    drawInnerGlow(ctx,W,H){

        const g=ctx.createRadialGradient(
            W/2,
            H/2,
            W*.2,

            W/2,
            H/2,
            W*.75
        );

        g.addColorStop(.6,"rgba(0,0,0,0)");
        g.addColorStop(1,"rgba(0,0,0,.55)");

        ctx.fillStyle=g;
        ctx.fillRect(0,0,W,H);

    }

}