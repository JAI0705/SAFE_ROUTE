/**
 * Mock road network graph for India
 * This is a simplified representation of major roads in India
 * In a production environment, this would be fetched from a database or external API
 */

// Create a network of major cities in India with their coordinates
const cities = {
  delhi: { id: 'delhi', lat: 28.7041, lng: 77.1025 },
  mumbai: { id: 'mumbai', lat: 19.0760, lng: 72.8777 },
  bangalore: { id: 'bangalore', lat: 12.9716, lng: 77.5946 },
  chennai: { id: 'chennai', lat: 13.0827, lng: 80.2707 },
  kolkata: { id: 'kolkata', lat: 22.5726, lng: 88.3639 },
  hyderabad: { id: 'hyderabad', lat: 17.3850, lng: 78.4867 },
  ahmedabad: { id: 'ahmedabad', lat: 23.0225, lng: 72.5714 },
  pune: { id: 'pune', lat: 18.5204, lng: 73.8567 },
  jaipur: { id: 'jaipur', lat: 26.9124, lng: 75.7873 },
  lucknow: { id: 'lucknow', lat: 26.8467, lng: 80.9462 },
  kanpur: { id: 'kanpur', lat: 26.4499, lng: 80.3319 },
  nagpur: { id: 'nagpur', lat: 21.1458, lng: 79.0882 },
  indore: { id: 'indore', lat: 22.7196, lng: 75.8577 },
  thane: { id: 'thane', lat: 19.2183, lng: 72.9781 },
  bhopal: { id: 'bhopal', lat: 23.2599, lng: 77.4126 },
  visakhapatnam: { id: 'visakhapatnam', lat: 17.6868, lng: 83.2185 },
  patna: { id: 'patna', lat: 25.5941, lng: 85.1376 },
  vadodara: { id: 'vadodara', lat: 22.3072, lng: 73.1812 },
  ghaziabad: { id: 'ghaziabad', lat: 28.6692, lng: 77.4538 },
  ludhiana: { id: 'ludhiana', lat: 30.9010, lng: 75.8573 },
  agra: { id: 'agra', lat: 27.1767, lng: 78.0081 },
  kochi: { id: 'kochi', lat: 9.9312, lng: 76.2673 },
  surat: { id: 'surat', lat: 21.1702, lng: 72.8311 },
  varanasi: { id: 'varanasi', lat: 25.3176, lng: 82.9739 }
};

// Create intermediate nodes along major highways
const intermediateNodes = {
  // Delhi-Mumbai highway nodes
  'dm1': { id: 'dm1', lat: 27.0238, lng: 76.3425 },
  'dm2': { id: 'dm2', lat: 25.4358, lng: 75.6473 },
  'dm3': { id: 'dm3', lat: 24.5854, lng: 74.9387 },
  'dm4': { id: 'dm4', lat: 23.0302, lng: 73.5975 },
  'dm5': { id: 'dm5', lat: 21.7051, lng: 73.0059 },
  
  // Mumbai-Bangalore highway nodes
  'mb1': { id: 'mb1', lat: 18.9613, lng: 72.9722 },
  'mb2': { id: 'mb2', lat: 17.6599, lng: 74.0049 },
  'mb3': { id: 'mb3', lat: 16.8302, lng: 74.6399 },
  'mb4': { id: 'mb4', lat: 15.8497, lng: 74.4977 },
  'mb5': { id: 'mb5', lat: 14.8227, lng: 75.7140 },
  'mb6': { id: 'mb6', lat: 13.9388, lng: 76.9456 },
  
  // Bangalore-Chennai highway nodes
  'bc1': { id: 'bc1', lat: 13.0359, lng: 77.9952 },
  'bc2': { id: 'bc2', lat: 13.0098, lng: 78.6926 },
  'bc3': { id: 'bc3', lat: 12.9777, lng: 79.1394 },
  
  // Delhi-Kolkata highway nodes
  'dk1': { id: 'dk1', lat: 27.5726, lng: 78.6451 },
  'dk2': { id: 'dk2', lat: 26.8035, lng: 80.8477 },
  'dk3': { id: 'dk3', lat: 25.9209, lng: 82.9977 },
  'dk4': { id: 'dk4', lat: 25.3333, lng: 83.9961 },
  'dk5': { id: 'dk5', lat: 24.7914, lng: 85.0002 },
  'dk6': { id: 'dk6', lat: 24.2748, lng: 86.0121 },
  'dk7': { id: 'dk7', lat: 23.6478, lng: 87.0478 },
  
  // Mumbai-Chennai highway nodes
  'mc1': { id: 'mc1', lat: 18.3273, lng: 73.1525 },
  'mc2': { id: 'mc2', lat: 17.6599, lng: 74.0049 },
  'mc3': { id: 'mc3', lat: 16.8302, lng: 74.6399 },
  'mc4': { id: 'mc4', lat: 15.8497, lng: 74.4977 },
  'mc5': { id: 'mc5', lat: 15.3350, lng: 75.1399 },
  'mc6': { id: 'mc6', lat: 14.4673, lng: 76.4026 },
  'mc7': { id: 'mc7', lat: 14.0756, lng: 77.1789 },
  'mc8': { id: 'mc8', lat: 13.6288, lng: 78.5783 },
  'mc9': { id: 'mc9', lat: 13.2343, lng: 79.6370 }
};

// Combine all nodes
const allNodes = { ...cities, ...intermediateNodes };

// Create the road network graph
const roadNetworkGraph = {};

// Helper function to add a connection between two nodes
function addConnection(node1Id, node2Id) {
  if (!roadNetworkGraph[node1Id]) {
    roadNetworkGraph[node1Id] = [];
  }
  if (!roadNetworkGraph[node2Id]) {
    roadNetworkGraph[node2Id] = [];
  }
  
  roadNetworkGraph[node1Id].push(allNodes[node2Id]);
  roadNetworkGraph[node2Id].push(allNodes[node1Id]);
}

// Connect Delhi to Mumbai via highway
addConnection('delhi', 'dm1');
addConnection('dm1', 'jaipur');
addConnection('jaipur', 'dm2');
addConnection('dm2', 'dm3');
addConnection('dm3', 'udaipur');
addConnection('dm3', 'dm4');
addConnection('dm4', 'ahmedabad');
addConnection('ahmedabad', 'vadodara');
addConnection('vadodara', 'dm5');
addConnection('dm5', 'surat');
addConnection('surat', 'mumbai');

// Connect Mumbai to Bangalore
addConnection('mumbai', 'mb1');
addConnection('mb1', 'pune');
addConnection('pune', 'mb2');
addConnection('mb2', 'mb3');
addConnection('mb3', 'mb4');
addConnection('mb4', 'mb5');
addConnection('mb5', 'mb6');
addConnection('mb6', 'bangalore');

// Connect Bangalore to Chennai
addConnection('bangalore', 'bc1');
addConnection('bc1', 'bc2');
addConnection('bc2', 'bc3');
addConnection('bc3', 'chennai');

// Connect Delhi to Kolkata
addConnection('delhi', 'ghaziabad');
addConnection('ghaziabad', 'dk1');
addConnection('dk1', 'agra');
addConnection('agra', 'kanpur');
addConnection('kanpur', 'dk2');
addConnection('dk2', 'lucknow');
addConnection('lucknow', 'dk3');
addConnection('dk3', 'varanasi');
addConnection('varanasi', 'dk4');
addConnection('dk4', 'dk5');
addConnection('dk5', 'patna');
addConnection('patna', 'dk6');
addConnection('dk6', 'dk7');
addConnection('dk7', 'kolkata');

// Connect Mumbai to Chennai
addConnection('mumbai', 'mc1');
addConnection('mc1', 'pune');
addConnection('pune', 'mc2');
addConnection('mc2', 'mc3');
addConnection('mc3', 'mc4');
addConnection('mc4', 'mc5');
addConnection('mc5', 'mc6');
addConnection('mc6', 'mc7');
addConnection('mc7', 'hyderabad');
addConnection('hyderabad', 'mc8');
addConnection('mc8', 'mc9');
addConnection('mc9', 'chennai');

// Connect other major cities
addConnection('delhi', 'lucknow');
addConnection('lucknow', 'patna');
addConnection('patna', 'kolkata');
addConnection('mumbai', 'nagpur');
addConnection('nagpur', 'hyderabad');
addConnection('hyderabad', 'chennai');
addConnection('bangalore', 'hyderabad');
addConnection('ahmedabad', 'indore');
addConnection('indore', 'bhopal');
addConnection('bhopal', 'nagpur');
addConnection('chennai', 'visakhapatnam');
addConnection('visakhapatnam', 'kolkata');
addConnection('kochi', 'bangalore');

module.exports = roadNetworkGraph;
