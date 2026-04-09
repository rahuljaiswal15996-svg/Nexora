export default function PipelinesPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/flow',
      permanent: false,
    },
  };
}
