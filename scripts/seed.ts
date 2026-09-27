export {};
try{process.loadEnvFile('.env');}catch{/* Host environment is also supported. */}
const {initializeDatabase,inDatabase,prisma}=await import('../server/data/database');
const {getMemoryDb}=await import('../server/data/memoryStore');
const {hashPassword}=await import('../server/auth');
await initializeDatabase();
await inDatabase(async()=>{
 const db=getMemoryDb();
 for(const profile of db.profiles.filter(p=>p.isDemoPersona||p.displayName==='Arnav Sawant')){
  profile.userId ||= profile.id;
  if(!db.users.some(u=>u.id===profile.userId))db.users.push({id:profile.userId,email:`${profile.displayName.toLowerCase().replaceAll(' ','.')}@partnerup.test`,passwordHash:null,createdAt:new Date().toISOString()});
  const account=db.users.find(u=>u.id===profile.userId)!;
  if(!account.passwordHash)account.passwordHash=hashPassword('PartnerUpDemo!26');
 }
});
console.log('Seeded fictional adult demo accounts. Password: PartnerUpDemo!26');
await prisma().$disconnect();
