export default function PlatformPage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/home',
      permanent: false,
    },
  };
}