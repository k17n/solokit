import { Button } from '@solokit/ui';
import { PageShell } from '../src/components/PageShell';

export default function NotFound() {
  return (
    <PageShell eyebrow="Error 404" title="That page does not exist" lede="The link may be old, or the tool may not be built yet.">
      <Button href="/">Go to the home page</Button>
    </PageShell>
  );
}
