export default function GovernancePage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/governance/policies',
      permanent: false,
    },
  };
}
