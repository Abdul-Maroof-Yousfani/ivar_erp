const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://courierify.growzar.com/api/external/orders/124619', {
      headers: { 'Authorization': 'Bearer ckf_live_9ca4054df2d5e69eadc254767cc24bef23227974a4b73f7863c277906892dae6' }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
test();
