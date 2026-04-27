export default function TestRoutePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test Route Page</h1>
      <p>If you can see this page, the routing is working correctly!</p>
      <p>Current URL should be: master.localtest.me:3001/test-route</p>
      <p>Internal path: /master/test-route</p>
    </div>
  );
}