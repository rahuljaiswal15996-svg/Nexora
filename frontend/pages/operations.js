export default function OperationsPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/runtime',
      permanent: false,
    },
  };
}
