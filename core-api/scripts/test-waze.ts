import axios from 'axios';

async function main() {
  const startLat = 4.0594;
  const startLng = 9.7503;
  const endLat = 4.0628;
  const endLng = 9.7297;

  const url = 'https://routing-livemap-row.waze.com/RoutingManager/routingRequest';
  try {
    const response = await axios.get(url, {
      params: {
        from: `x:${startLng} y:${startLat}`,
        to: `x:${endLng} y:${endLat}`,
        returnJSON: 'true',
        returnGeometries: 'true',
        returnInstructions: 'true',
        timeout: '60000',
        nPaths: '1',
        options: 'AVOID_TRAILS:t,ALLOW_UTURNS:t'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.waze.com/'
      }
    });

    console.log('✅ Response status:', response.status);
    console.log('Response keys:', Object.keys(response.data));
    if (response.data.response) {
      console.log('Response properties:', Object.keys(response.data.response));
      const routes = response.data.response.results || response.data.response.routes;
      if (routes && routes.length > 0) {
        console.log('Route count:', routes.length);
        const route = routes[0];
        console.log('Route keys:', Object.keys(route));
        
        // Let's inspect some of the street/jams properties
        console.log('Total length:', route.length);
        console.log('Total time:', route.crossTime);
        console.log('Route description:', route.routeName);
      } else {
        console.log('No routes found. Response body sample:', JSON.stringify(response.data).substring(0, 1000));
      }
    } else {
      console.log('No "response" key found. Full data keys:', Object.keys(response.data));
      console.log(JSON.stringify(response.data).substring(0, 1000));
    }
  } catch (e: any) {
    console.error('❌ Error calling Waze:', e.message);
    if (e.response) {
      console.error('Error status:', e.response.status);
      console.error('Error data:', e.response.data);
    }
  }
}

main();
