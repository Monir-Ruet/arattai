const fs=require('fs');
const express =require('express');
const metaphone=require('metaphone');
const compression=require('compression');
const mysql=require('./mysql');
const connection=mysql.connection;
const ejs=require('ejs');
const app=express();

app.use(ignoreFavicon);
app.use(compression());
app.set('view engine','ejs');
app.use(express.static('public'));

function ignoreFavicon(req, res, next) { if (req.originalUrl === '/favicon.ico') {res.status(204).json({nope: true});} else { next(); } }


var href={'latest':1,'trending':1,'comedy':1,'romance':1,'drama':1,'thriller':1,'horror':1,'action':1,'war':1,'crime':1,'adventure':1,'animation':1,'sport':1,
'sci-fi':1,'documentary':1,'history':1,'music':1,'family':1,'western':1,'mystery':1,'fantasy':1,}

app.get('/',async(req,res)=>{
	let sql="SELECT * FROM `movie` ORDER BY year DESC,id DESC LIMIT 24;SELECT * FROM `movie` ORDER BY views DESC, year DESC LIMIT 24;SELECT * FROM `movie` WHERE genre LIKE '%Comedy%' ORDER BY views DESC, year DESC LIMIT 24;SELECT * FROM `movie` WHERE genre LIKE '%Romance%' ORDER BY views DESC, year DESC LIMIT 24";
	connection.query(sql,(err,result)=>{
		if(err){ return; }
		res.render('index',{
			latest:result[0],
			popular:result[1],
			comedy:result[2],
			romance:result[3],
		})
	})
})
function sitemapappend(){
	var result=[];
	connection.query('SELECT COUNT(*) FROM `movie`',(err,res)=>{
		var total=res[0]['COUNT(*)'];
		connection.query('SELECT crawled FROM sitemap WHERE id=0',(err,res)=>{
			var prev=res[0].crawled;
			var limit=total-prev;
			if(limit===0) return;
			var sql='SELECT uniqueid FROM movie ORDER BY id DESC LIMIT '+limit;
			var xml;
			fs.readFile('./public/sitemap1.xml','utf8',(err,data)=>{
				if(err) throw err;
				xml=data;
				var newxml=data.replace('</urlset>','');
				connection.query(sql,(err,res)=>{
					for(var i=0;i<res.length;i++){
						newxml+='<url><loc>https://fukmovies.rocks/watch?v='+res[i].uniqueid+'</loc><changefreq>daily</changefreq><priority>0.8</priority></url>';
					}
					newxml+='</urlset>';

					fs.writeFile('./public/sitemap1.xml',newxml,(err)=>{
						if(err) throw err;
					})
					connection.query('UPDATE `sitemap` SET `crawled`='+total,(err,res)=>{
						if(err) throw err;
					})
				})
			})
		})
	})
}
sitemapappend();
setInterval(function() {
	sitemapappend();
},86400000);


app.get('/sitemap.xml', async(req, res) =>{
	res.header('Content-Type', 'application/xml');
	res.send( fs.readFileSync(require('path').resolve(__dirname,'../public/sitemap.xml'), "utf8") );
})


app.get('/sitemap1.xml', async(req, res) =>{
	res.header('Content-Type', 'application/xml');
	res.send( fs.readFileSync(require('path').resolve(__dirname,'../public/sitemap1.xml'), "utf8") );
})


app.get('/robots.txt',async(req,res)=>{
	res.header('Content-Type', 'text/plain');
	res.render('/public/robots.txt');
})


app.get('/search',async(req,res)=>{
	var limit=30;
	if((req.query.content && !req.query.offset) || (!req.query.content && req.query.offset) || !req.query.q){
		return res.render('error',{error:'Page Not Found'});
	}
	if(!req.query.offset || !req.query.content){ return res.render('search',{q:req.query.q}); }
	else{
		var query=metaphone(req.query.q);
		sql="SELECT * FROM `movie` WHERE name LIKE '%"+req.query.q+"%' OR metaphone LIKE '%"+query+"%' ORDER BY CASE WHEN name LIKE '"+req.query.q+"' THEN 1 WHEN name LIKE '"+req.query.q+"%' THEN 2 WHEN name LIKE '"+req.query.q+"%' THEN 4 ELSE 3 END LIMIT "+limit+" OFFSET "+req.query.offset;
		connection.query(sql,(err,result)=>{
			if (err) { return ;}
			var a=[];
			for(var i=0;i<Math.min(10,result.length);i++){
				a+='<a href="/search?q='+result[i].name+'"><p class="search-res">'+result[i].name+'</p></a>';
			}
			if(req.query.content==='search'){
				if(result.length==0){res.send('');}
				else
					res.status(200).send(a);
			}
			else
				res.status(200).send(result);
		});
	}
})


app.get('/watch',async(req,res)=>{
	let vid=req.query.v,offset=req.query.offset;
	if(!vid) 
		return res.send("NOT FOUND")
	let sql="SELECT COUNT(*) FROM `embed` WHERE uniqueid='"+vid+"'";
	connection.query(sql,(err,result)=>{
		if(err){ return; }

		if(req.query.offset){
			if(req.query.offset && result[0]['COUNT(*)']==0)
				return res.send('{}');
			var offset=0;
			offset=parseInt(req.query.offset);
			if(isNaN(offset)){
				res.send({});
			}
			sql="SELECT id FROM `movie` WHERE uniqueid='"+vid+"';";
			connection.query(sql,function(err,result){
				if(err) throw err;
				sql="SELECT * FROM `movie` ORDER BY views DESC LIMIT "+Math.max(0,(result[0].id+offset-5))+",20";
				connection.query(sql,function(e,re){
					if(e) {};
					return res.send(re);
				})
			})
		}

		else{
			if(result[0]['COUNT(*)']==0)
				return res.render('error',{error:'Video Unavailable'});
			else{
				connection.query("UPDATE `movie` SET views=views+1 WHERE uniqueid='"+vid+"'",function(err,result){
					if(err) throw err;
				});
				sql="SELECT * FROM `movie` WHERE uniqueid='"+vid+"';SELECT * FROM `embed` WHERE uniqueid='"+vid+"';";
				connection.query(sql,function(err,result){
					if(err) throw err;					
					res.render('player',{video:result[0],server:result[1]});
				})
			}
		}
	})
})


app.get('/:name',async(req,res,next)=>{
	var valid=undefined,sql=undefined;
	var cat=req.params.name, pval=req.query.page, pnum=parseInt(pval,10);
	if(href[cat]!=1 || pval<1 || isNaN(pnum)){
		return res.render('error',{error:'Page Not Found'});
	}
	if(pval!=pnum){ res.writeHead(301,{"Location":'http://'+req.headers['host']+"/"+cat+"?page="+pnum}); return res.end(); }
	var limit=24;
	if(cat==='latest') 
		sql="SELECT COUNT(*) FROM `movie`;SELECT * FROM `movie` ORDER BY year DESC,id DESC LIMIT "+limit+" OFFSET "+(limit*(pnum-1));
	else if(cat==='trending') 
		sql="SELECT COUNT(*) FROM `movie`;SELECT * FROM `movie` ORDER BY views DESC,year DESC LIMIT "+limit+" OFFSET "+(limit*(pnum-1));
	else 
		sql="SELECT COUNT(*) FROM `movie` WHERE genre LIKE '%"+cat+"%';SELECT * FROM `movie` WHERE genre LIKE '%"+cat+"%' ORDER BY views DESC,year DESC LIMIT "+limit+" OFFSET "+(limit*(pnum-1));
	var p=cat.toUpperCase();
	connection.query(sql, function(err, result) {
		if(err) {}
			if(result=="")
				response.send("No data");
			else{
				var total=result[0][0]['COUNT(*)'];
				pval=Math.min(parseInt((total+25)/25),pval);
				res.render('main',{
					count:result[0],
					result:result[1],
					catagory:p,
					page:pval,

				})
			}
		});
})


app.get('*',(req,res)=>{
	return res.render('error',{error:'Page Not Found'});
})

module.exports=app;