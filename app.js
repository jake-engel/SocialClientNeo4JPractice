const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const neo4j = require('neo4j-driver').v1;

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "password"));
const session = driver.session();

// Home Route
app.get('/', async (req, res) => {
  try {
    const result = await session.run("MATCH (n:Person) RETURN n LIMIT 15");
    const personArr = [];
    result.records.forEach(record => {
      personArr.push({
        id: record._fields[0].identity.low,
        name: record._fields[0].properties.name
      })
    });

    const result2 = await session.run("MATCH (n:Location) RETURN n");
    const locationArr = [];
    result2.records.forEach(record => {
      locationArr.push(record._fields[0].properties);
    });
    res.render('index', {
      persons: personArr,
      locations: locationArr
    });
  } catch (err) {
    console.log(err);
  }
  session.close();
})

// Add Person
app.post('/person/add', async (req, res) => {
  const name = req.body.name;
  try {
    const result = await session.run("CREATE(n:Person{name:{nameParam}}) RETURN n.name ORDER BY n.id", {
      nameParam: name
    });

    res.redirect('/');
    session.close();
  } catch (err) {
    console.log(err);
  }
  session.close();
});

// Add Location
app.post('/location/add', async (req, res) => {
  const city = req.body.city;
  const state = req.body.state;
  try {
    const result = await session.run("CREATE(n:Location{city:{cityParam}, state:{stateParam}}) RETURN n ORDER BY n.id", {
      cityParam: city, 
      stateParam: state
    });

    res.redirect('/');
    session.close();
  } catch (err) {
    console.log(err);
  }
  session.close();
});

// Add Friends Relationship
app.post('/friends/connect', async (req, res) => {
  const name1 = req.body.name1;
  const name2 = req.body.name2;
  const id = req.body.id;
  try {
    const result = await session.run("MATCH(p1:Person{name:{nameParam1}}),(p2:Person{name:{nameParam2}}) MERGE(p1)-[r:FRIENDS]->(p2) RETURN p1, p2", {
      nameParam1: name1, 
      nameParam2: name2
    });
    
    id ? res.redirect(`/person/${id}`) : res.redirect('/');
  } catch (err) {
    console.log(err);
  }
  session.close();
});

// Add Born In Relationship
app.post('/person/born/add', async (req, res) => {
  const name = req.body.name;
  const city = req.body.city;
  const state = req.body.state;
  const year = req.body.year;
  const id = req.body.id;
  try {
    const result = await session.run("MATCH(p:Person{name:{nameParam}}),(l:Location{city:{cityParam}, state:{stateParam}}) MERGE(p)-[r:BORN_IN{year:{yearParam}}]->(l) RETURN p, l", {
      nameParam: name, 
      cityParam: city, 
      stateParam: state,
      yearParam: year
    });

    id ? res.redirect(`/person/${id}`) : res.redirect('/');    session.close();
  } catch (err) {
    console.log(err);
  }
  session.close();
});

// Individual Person Route
app.get('/person/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result1 = await session.run("MATCH(p:Person) WHERE id(p)=toInt({idParam}) RETURN p.name as name", {
      idParam: id
    });
    const name = result1.records[0].get("name");
    const result2 = await session.run("OPTIONAL MATCH (p:Person)-[r:BORN_IN]-(l:Location) WHERE id(p)=toInt({idParam}) RETURN l.city as city, l.state as state", {
      idParam: id
    });
    const city = result2.records[0].get("city");
    const state = result2.records[0].get("state");
    const result3 = await session.run("OPTIONAL MATCH (p1:Person)-[r:FRIENDS]-(p2:Person) WHERE id(p1)=toInt({idParam}) RETURN p2", {
      idParam: id
    });
    const friendsArr = [];
    result3.records.forEach(record => {
      if (record._fields[0]) {
        friendsArr.push({
          id: record._fields[0].identity.low,
          name: record._fields[0].properties.name
        })
      }
    });
    res.render('person', { id, name, city, state, friends: friendsArr })
  } catch (err) {
    console.log(err);
  }
  session.close();
})

app.listen(3000, () => {
  console.log('Server started on port 3000!')
});

module.exports = app;