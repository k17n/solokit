import { Button, SiteFooter, SiteHeader } from '@solokit/ui';
import { PageShell } from '../src/components/PageShell';
import { HEADER_PROPS, getFooterProps } from '../src/site';

export default function NotFound() {
  return (
    <>
      <SiteHeader {...HEADER_PROPS} />
      <PageShell eyebrow="Error 404" title="That page does not exist" lede="The link may be old, or the tool may not be built yet.">
        <Button href="/">Go to the home page</Button>
      </PageShell>
      <SiteFooter {...getFooterProps()} />
    </>
  );
}
